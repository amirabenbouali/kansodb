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

async function createPersistentDatabase(adapter = new MemoryFileAdapter()) {
  const database = await Database.open({ path: "db.json", fileAdapter: adapter });
  await executeSqlAsync(database, "CREATE TABLE accounts (id INTEGER PRIMARY KEY, owner TEXT NOT NULL UNIQUE);");
  await executeSqlAsync(database, "INSERT INTO accounts VALUES (1, 'Amira');");
  return { database, adapter };
}

describe("SAVE execution", () => {
  it("saves persistent databases and updates metadata", async () => {
    const { database, adapter } = await createPersistentDatabase();
    const result = await executeSqlAsync(database, "SAVE;");

    expect(result).toMatchObject({
      type: "persistence",
      action: "SAVE",
      path: "db.json"
    });
    expect(result.type === "persistence" ? result.bytesWritten : 0).toBeGreaterThan(0);
    expect(database.persistenceState).toMatchObject({ dirty: false, lastSavedBytes: result.type === "persistence" ? result.bytesWritten : null });
    expect(new DatabaseCodec().decode(adapter.files.get("db.json") ?? "")).toMatchObject({ tables: [{ name: "accounts" }] });
  });

  it("rejects SAVE for memory databases and active transactions", async () => {
    await expect(executeSqlAsync(new Database(), "SAVE;")).rejects.toMatchObject({ code: "PERSISTENCE_PATH_NOT_CONFIGURED" });

    const { database } = await createPersistentDatabase();
    await executeSqlAsync(database, "BEGIN;");
    await executeSqlAsync(database, "UPDATE accounts SET owner = 'Amira B' WHERE id = 1;");
    await expect(executeSqlAsync(database, "SAVE;")).rejects.toMatchObject({ code: "SAVE_DURING_ACTIVE_TRANSACTION" });
    expect(database.transactionState).toBe("ACTIVE");
  });

  it("saves restored state after rollback and committed state after commit", async () => {
    const { database, adapter } = await createPersistentDatabase();
    await executeSqlAsync(database, "SAVE;");

    await executeSqlScriptAsync(database, "BEGIN; INSERT INTO accounts VALUES (2, 'Sara'); ROLLBACK; SAVE;");
    let reopened = await Database.open({ path: "db.json", fileAdapter: adapter });
    expect(await executeSqlAsync(reopened, "SELECT id, owner FROM accounts ORDER BY id ASC;")).toMatchObject({
      rows: [{ id: 1, owner: "Amira" }]
    });

    await executeSqlScriptAsync(database, "BEGIN; INSERT INTO accounts VALUES (2, 'Sara'); COMMIT; SAVE;");
    reopened = await Database.open({ path: "db.json", fileAdapter: adapter });
    expect(await executeSqlAsync(reopened, "SELECT id, owner FROM accounts ORDER BY id ASC;")).toMatchObject({
      rows: [{ id: 1, owner: "Amira" }, { id: 2, owner: "Sara" }]
    });
  });

  it("records SAVE success and failure in async scripts", async () => {
    const { database } = await createPersistentDatabase();
    const ok = await executeSqlScriptAsync(database, "SAVE; SELECT * FROM accounts;");
    expect(ok.statements.map((record) => record.status)).toEqual(["success", "success"]);
    expect(ok.statements[0]?.result).toMatchObject({ type: "persistence", action: "SAVE" });

    await executeSqlAsync(database, "BEGIN;");
    const failed = await executeSqlScriptAsync(database, "SAVE; SELECT * FROM accounts;", { stopOnError: true });
    expect(failed.statements.map((record) => record.status)).toEqual(["error", "skipped"]);
    expect(failed.statements[0]?.error).toMatchObject({ code: "SAVE_DURING_ACTIVE_TRANSACTION" });
  });

  it("does not dirty or save on SELECT", async () => {
    const { database, adapter } = await createPersistentDatabase();
    await executeSqlAsync(database, "SAVE;");
    const before = adapter.files.get("db.json");

    await executeSqlAsync(database, "SELECT * FROM accounts;");

    expect(database.persistenceState.dirty).toBe(false);
    expect(adapter.files.get("db.json")).toBe(before);
  });
});
