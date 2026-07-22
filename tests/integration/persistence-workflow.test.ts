import { describe, expect, it } from "vitest";
import {
  Database,
  DatabaseCodec,
  PersistenceError,
  executeSqlAsync,
  executeSqlScriptAsync,
  type FileAdapter
} from "../../src/index.js";

class MemoryFileAdapter implements FileAdapter {
  public readonly files = new Map<string, string>();
  public failWrite = false;

  public async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  public async readText(path: string): Promise<string> {
    const value = this.files.get(path);
    if (value === undefined) {
      throw new PersistenceError({ code: "PERSISTENCE_READ_FAILED", message: "Missing file", path });
    }
    return value;
  }

  public async writeText(path: string, contents: string): Promise<void> {
    if (this.failWrite) {
      throw new PersistenceError({ code: "PERSISTENCE_WRITE_FAILED", message: "Injected failure", path });
    }
    this.files.set(path, contents);
  }

  public async rename(from: string, to: string): Promise<void> {
    const value = this.files.get(from);
    if (value === undefined) {
      throw new PersistenceError({ code: "PERSISTENCE_RENAME_FAILED", message: "Missing source", path: to });
    }
    this.files.delete(from);
    this.files.set(to, value);
  }

  public async remove(path: string): Promise<void> {
    this.files.delete(path);
  }

  public async ensureDirectory(): Promise<void> {
    return;
  }
}

async function seed(database: Database): Promise<void> {
  await executeSqlAsync(database, "CREATE TABLE departments (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);");
  await executeSqlAsync(database, "CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT NOT NULL, department_id INTEGER NULL, salary DECIMAL, active BOOLEAN NOT NULL, FOREIGN KEY (department_id) REFERENCES departments(id));");
  await executeSqlAsync(database, "INSERT INTO departments VALUES (1, 'Engineering');");
  await executeSqlAsync(database, "INSERT INTO departments VALUES (2, 'Design');");
  await executeSqlAsync(database, "INSERT INTO employees VALUES (1, 'Amira', 1, 48000, TRUE);");
  await executeSqlAsync(database, "INSERT INTO employees VALUES (2, 'Maya', 2, 42000.5, TRUE);");
  await executeSqlAsync(database, "INSERT INTO employees VALUES (3, 'Lina', NULL, 45000, TRUE);");
}

async function join(database: Database) {
  return executeSqlAsync(
    database,
    `
    SELECT
      e.name AS employee,
      d.name AS department,
      e.salary
    FROM employees e
    LEFT JOIN departments d
      ON e.department_id = d.id
    ORDER BY employee ASC;
    `
  );
}

describe("persistence workflow", () => {
  it("saves and reopens a full constrained database", async () => {
    const adapter = new MemoryFileAdapter();
    const database = await Database.open({ path: "kanso.db.json", fileAdapter: adapter });
    await seed(database);
    const save = await executeSqlAsync(database, "SAVE;");

    const reopened = await Database.open({ path: "kanso.db.json", fileAdapter: adapter });

    expect(save).toMatchObject({ type: "persistence", path: "kanso.db.json" });
    expect(await join(reopened)).toEqual({
      type: "query",
      columns: ["employee", "department", "e.salary"],
      rows: [
        { employee: "Amira", department: "Engineering", "e.salary": 48000 },
        { employee: "Lina", department: null, "e.salary": 45000 },
        { employee: "Maya", department: "Design", "e.salary": 42000.5 }
      ],
      rowCount: 3
    });
  });

  it("preserves constraints after reopening", async () => {
    const adapter = new MemoryFileAdapter();
    const database = await Database.open({ path: "kanso.db.json", fileAdapter: adapter });
    await seed(database);
    await executeSqlAsync(database, "SAVE;");
    const reopened = await Database.open({ path: "kanso.db.json", fileAdapter: adapter });

    await expect(executeSqlAsync(reopened, "INSERT INTO employees VALUES (1, 'Other', 1, 1, TRUE);")).rejects.toMatchObject({ code: "PRIMARY_KEY_VIOLATION" });
    await expect(executeSqlAsync(reopened, "INSERT INTO departments VALUES (3, 'Engineering');")).rejects.toMatchObject({ code: "UNIQUE_CONSTRAINT_VIOLATION" });
    await expect(executeSqlAsync(reopened, "INSERT INTO employees VALUES (4, 'Sara', 999, 46000, TRUE);")).rejects.toMatchObject({ code: "FOREIGN_KEY_VIOLATION" });
    await expect(executeSqlAsync(reopened, "DELETE FROM departments WHERE id = 1;")).rejects.toMatchObject({ code: "REFERENCED_ROW_EXISTS" });
    await executeSqlAsync(reopened, "INSERT INTO employees VALUES (4, 'Sara', NULL, 46000, TRUE);");
  });

  it("keeps transaction state and history out of persisted files", async () => {
    const adapter = new MemoryFileAdapter();
    const database = await Database.open({ path: "kanso.db.json", fileAdapter: adapter });
    await seed(database);
    await executeSqlAsync(database, "SAVE;");

    await executeSqlScriptAsync(database, "BEGIN; INSERT INTO employees VALUES (4, 'Sara', 1, 46000, TRUE); ROLLBACK; SAVE;");
    let reopened = await Database.open({ path: "kanso.db.json", fileAdapter: adapter });
    expect(reopened.transactionState).toBe("IDLE");
    expect(await executeSqlAsync(reopened, "SELECT name FROM employees WHERE name = 'Sara';")).toMatchObject({ rows: [] });

    await executeSqlScriptAsync(database, "BEGIN; INSERT INTO employees VALUES (4, 'Sara', 1, 46000, TRUE); COMMIT; SAVE;");
    reopened = await Database.open({ path: "kanso.db.json", fileAdapter: adapter });
    expect(await executeSqlAsync(reopened, "SELECT name FROM employees WHERE name = 'Sara';")).toMatchObject({
      rows: [{ name: "Sara" }]
    });
  });

  it("rejects save during active transaction and leaves file unchanged", async () => {
    const adapter = new MemoryFileAdapter();
    const database = await Database.open({ path: "kanso.db.json", fileAdapter: adapter });
    await seed(database);
    await executeSqlAsync(database, "SAVE;");
    const before = adapter.files.get("kanso.db.json");

    await executeSqlAsync(database, "BEGIN;");
    await executeSqlAsync(database, "UPDATE employees SET salary = salary + 1000 WHERE id = 1;");
    await expect(executeSqlAsync(database, "SAVE;")).rejects.toMatchObject({ code: "SAVE_DURING_ACTIVE_TRANSACTION" });
    expect(adapter.files.get("kanso.db.json")).toBe(before);
    expect(await executeSqlAsync(database, "SELECT salary FROM employees WHERE id = 1;")).toMatchObject({ rows: [{ salary: 49000 }] });
    await executeSqlAsync(database, "ROLLBACK;");
  });

  it("auto-saves after commit and preserves committed memory when auto-save fails", async () => {
    const adapter = new MemoryFileAdapter();
    const database = await Database.open({ path: "kanso.db.json", fileAdapter: adapter, autoSave: "on-commit" });
    await seed(database);
    expect(adapter.files.has("kanso.db.json")).toBe(true);

    await executeSqlScriptAsync(database, "BEGIN; INSERT INTO employees VALUES (4, 'Sara', 1, 46000, TRUE); COMMIT;");
    let reopened = await Database.open({ path: "kanso.db.json", fileAdapter: adapter });
    expect(await executeSqlAsync(reopened, "SELECT name FROM employees WHERE name = 'Sara';")).toMatchObject({ rows: [{ name: "Sara" }] });

    adapter.failWrite = true;
    await expect(executeSqlAsync(database, "INSERT INTO employees VALUES (5, 'Noah', 1, 47000, TRUE);")).rejects.toMatchObject({
      code: "AUTO_SAVE_FAILED",
      databaseStateCommitted: true,
      persistenceSucceeded: false
    });
    expect(await executeSqlAsync(database, "SELECT name FROM employees WHERE name = 'Noah';")).toMatchObject({ rows: [{ name: "Noah" }] });
    expect(database.persistenceState.dirty).toBe(true);

    adapter.failWrite = false;
    await executeSqlAsync(database, "SAVE;");
    reopened = await Database.open({ path: "kanso.db.json", fileAdapter: adapter });
    expect(await executeSqlAsync(reopened, "SELECT name FROM employees WHERE name = 'Noah';")).toMatchObject({ rows: [{ name: "Noah" }] });
  });

  it("rolls back failed atomic scripts without saving and saves successful atomic scripts", async () => {
    const adapter = new MemoryFileAdapter();
    const database = await Database.open({ path: "kanso.db.json", fileAdapter: adapter, autoSave: "on-commit" });
    await seed(database);
    const before = adapter.files.get("kanso.db.json");

    const failed = await executeSqlScriptAsync(database, "INSERT INTO employees VALUES (4, 'Sara', 1, 46000, TRUE); INSERT INTO employees VALUES (1, 'Other', 1, 1, TRUE);", { atomic: true, stopOnError: false });
    expect(failed).toMatchObject({ committed: false, rolledBack: true });
    expect(adapter.files.get("kanso.db.json")).toBe(before);

    const succeeded = await executeSqlScriptAsync(database, "INSERT INTO employees VALUES (4, 'Sara', 1, 46000, TRUE); UPDATE employees SET salary = salary + 1000 WHERE id = 1;", { atomic: true });
    expect(succeeded).toMatchObject({ committed: true, rolledBack: false });
    const reopened = await Database.open({ path: "kanso.db.json", fileAdapter: adapter });
    expect(await executeSqlAsync(reopened, "SELECT name FROM employees WHERE name = 'Sara';")).toMatchObject({ rows: [{ name: "Sara" }] });
  });

  it("recovers from interrupted saves using temp or backup files", async () => {
    const adapter = new MemoryFileAdapter();
    const database = await Database.open({ path: "kanso.db.json", fileAdapter: adapter });
    await seed(database);
    await executeSqlAsync(database, "SAVE;");
    const oldFinal = adapter.files.get("kanso.db.json") ?? "";

    await executeSqlAsync(database, "INSERT INTO employees VALUES (4, 'Sara', 1, 46000, TRUE);");
    const newPayload = new DatabaseCodec().encode(database.createSnapshot(), { savedAt: "2026-07-22T00:00:00.000Z" });
    adapter.files.delete("kanso.db.json");
    adapter.files.set("kanso.db.json.bak", oldFinal);
    adapter.files.set("kanso.db.json.tmp", newPayload);

    let reopened = await Database.open({ path: "kanso.db.json", fileAdapter: adapter });
    expect(await executeSqlAsync(reopened, "SELECT name FROM employees WHERE name = 'Sara';")).toMatchObject({ rows: [{ name: "Sara" }] });

    adapter.files.delete("kanso.db.json");
    adapter.files.set("kanso.db.json.bak", oldFinal);
    adapter.files.set("kanso.db.json.tmp", "{");
    reopened = await Database.open({ path: "kanso.db.json", fileAdapter: adapter });
    expect(await executeSqlAsync(reopened, "SELECT name FROM employees WHERE name = 'Sara';")).toMatchObject({ rows: [] });
  });

  it("rejects corrupt and unsupported-version files", async () => {
    const adapter = new MemoryFileAdapter();
    adapter.files.set("broken.json", "{");
    await expect(Database.open({ path: "broken.json", fileAdapter: adapter })).rejects.toMatchObject({ code: "PERSISTENCE_FILE_CORRUPT", path: "broken.json" });

    adapter.files.set("version.json", JSON.stringify({ format: "kansodb", version: 999, savedAt: "", database: { tables: [] } }));
    await expect(Database.open({ path: "version.json", fileAdapter: adapter })).rejects.toMatchObject({
      code: "UNSUPPORTED_STORAGE_VERSION",
      foundVersion: 999
    });
  });
});
