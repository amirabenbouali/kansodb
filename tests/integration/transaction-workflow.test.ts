import { describe, expect, it } from "vitest";
import { Database, ExecutionHistory, ScriptExecutor, executeSql, executeSqlScript, type QueryResult } from "../../src/index.js";

function createAccountsDatabase(): Database {
  const database = new Database();
  executeSql(database, "CREATE TABLE accounts (id INTEGER PRIMARY KEY, owner TEXT NOT NULL UNIQUE, balance DECIMAL NOT NULL);");
  executeSql(database, "INSERT INTO accounts VALUES (1, 'Amira', 1000);");
  executeSql(database, "INSERT INTO accounts VALUES (2, 'Maya', 500);");
  return database;
}

function accounts(database: Database): QueryResult {
  return executeSql(database, "SELECT id, owner, balance FROM accounts ORDER BY id ASC;") as QueryResult;
}

describe("transaction workflow integration", () => {
  it("commits account transfer workflow", () => {
    const database = createAccountsDatabase();

    executeSqlScript(
      database,
      `
      BEGIN;
      UPDATE accounts SET balance = balance - 100 WHERE id = 1;
      UPDATE accounts SET balance = balance + 100 WHERE id = 2;
      COMMIT;
      `
    );

    expect(accounts(database)).toEqual({
      type: "query",
      columns: ["id", "owner", "balance"],
      rows: [
        { id: 1, owner: "Amira", balance: 900 },
        { id: 2, owner: "Maya", balance: 600 }
      ],
      rowCount: 2
    });
  });

  it("rolls back account changes", () => {
    const database = createAccountsDatabase();

    executeSqlScript(
      database,
      `
      BEGIN;
      UPDATE accounts SET balance = balance - 250 WHERE id = 1;
      DELETE FROM accounts WHERE id = 2;
      INSERT INTO accounts VALUES (3, 'Sara', 800);
      ROLLBACK;
      `
    );

    expect(accounts(database)).toEqual({
      type: "query",
      columns: ["id", "owner", "balance"],
      rows: [
        { id: 1, owner: "Amira", balance: 1000 },
        { id: 2, owner: "Maya", balance: 500 }
      ],
      rowCount: 2
    });
  });

  it("commits parent and child changes while rollback restores referential state", () => {
    const database = new Database();
    executeSql(database, "CREATE TABLE departments (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);");
    executeSql(database, "CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT NOT NULL, department_id INTEGER, FOREIGN KEY (department_id) REFERENCES departments(id));");
    executeSql(database, "INSERT INTO departments VALUES (1, 'Engineering');");
    executeSql(database, "INSERT INTO departments VALUES (2, 'Design');");
    executeSql(database, "INSERT INTO employees VALUES (1, 'Amira', 1);");
    executeSql(database, "INSERT INTO employees VALUES (2, 'Maya', 2);");

    executeSqlScript(database, "BEGIN; INSERT INTO departments VALUES (3, 'Research'); INSERT INTO employees VALUES (3, 'Sara', 3); COMMIT;");
    expect(executeSql(database, "SELECT e.name AS employee, d.name AS department FROM employees e INNER JOIN departments d ON e.department_id = d.id ORDER BY employee ASC;")).toMatchObject({
      rows: [
        { employee: "Amira", department: "Engineering" },
        { employee: "Maya", department: "Design" },
        { employee: "Sara", department: "Research" }
      ]
    });

    executeSqlScript(database, "BEGIN; DELETE FROM employees WHERE department_id = 1; DELETE FROM departments WHERE id = 1; ROLLBACK;");
    expect(executeSql(database, "SELECT e.name AS employee, d.name AS department FROM employees e INNER JOIN departments d ON e.department_id = d.id ORDER BY employee ASC;")).toMatchObject({
      rows: [
        { employee: "Amira", department: "Engineering" },
        { employee: "Maya", department: "Design" },
        { employee: "Sara", department: "Research" }
      ]
    });
  });

  it("supports DDL rollback and DDL commit", () => {
    const rollbackDatabase = createAccountsDatabase();
    executeSqlScript(rollbackDatabase, "BEGIN; CREATE TABLE audit_log (id INTEGER PRIMARY KEY, message TEXT NOT NULL); INSERT INTO audit_log VALUES (1, 'created'); ROLLBACK;");
    expect(rollbackDatabase.hasTable("audit_log")).toBe(false);

    const commitDatabase = createAccountsDatabase();
    executeSqlScript(commitDatabase, "BEGIN; CREATE TABLE audit_log (id INTEGER PRIMARY KEY, message TEXT NOT NULL); INSERT INTO audit_log VALUES (1, 'created'); COMMIT;");
    expect(executeSql(commitDatabase, "SELECT id, message FROM audit_log;")).toMatchObject({
      rows: [{ id: 1, message: "created" }]
    });
  });

  it("preserves explicit transaction state across script stopOnError modes", () => {
    const stoppedDatabase = createAccountsDatabase();
    const stopped = executeSqlScript(stoppedDatabase, "BEGIN; INSERT INTO accounts VALUES (3, 'Sara', 800); INSERT INTO accounts VALUES (4, 'Amira', 200); ROLLBACK;", { stopOnError: true });

    expect(stopped.statements.map((record) => record.status)).toEqual(["success", "success", "error", "skipped"]);
    expect(stoppedDatabase.transactionState).toBe("ACTIVE");
    expect(accounts(stoppedDatabase)).toMatchObject({
      rows: [
        { id: 1, owner: "Amira", balance: 1000 },
        { id: 2, owner: "Maya", balance: 500 },
        { id: 3, owner: "Sara", balance: 800 }
      ]
    });
    executeSql(stoppedDatabase, "ROLLBACK;");

    const continuedDatabase = createAccountsDatabase();
    const continued = executeSqlScript(continuedDatabase, "BEGIN; INSERT INTO accounts VALUES (3, 'Sara', 800); INSERT INTO accounts VALUES (4, 'Amira', 200); ROLLBACK;", { stopOnError: false });
    expect(continued.statements.map((record) => record.status)).toEqual(["success", "success", "error", "success"]);
    expect(continuedDatabase.transactionState).toBe("IDLE");
    expect(accounts(continuedDatabase).rows).toEqual([
      { id: 1, owner: "Amira", balance: 1000 },
      { id: 2, owner: "Maya", balance: 500 }
    ]);
  });

  it("commits successful atomic scripts", () => {
    const database = createAccountsDatabase();
    const result = executeSqlScript(
      database,
      `
      UPDATE accounts SET balance = balance - 100 WHERE id = 1;
      UPDATE accounts SET balance = balance + 100 WHERE id = 2;
      SELECT id, owner, balance FROM accounts ORDER BY id ASC;
      `,
      { atomic: true, stopOnError: true }
    );

    expect(result).toMatchObject({ atomic: true, committed: true, rolledBack: false, failed: 0 });
    expect(result.statements[2]?.result).toMatchObject({
      rows: [
        { id: 1, owner: "Amira", balance: 900 },
        { id: 2, owner: "Maya", balance: 600 }
      ]
    });
    expect(accounts(database).rows).toEqual([
      { id: 1, owner: "Amira", balance: 900 },
      { id: 2, owner: "Maya", balance: 600 }
    ]);
  });

  it("rolls back failed atomic scripts while preserving statement records", () => {
    const database = createAccountsDatabase();
    const result = executeSqlScript(
      database,
      `
      UPDATE accounts SET balance = balance - 100 WHERE id = 1;
      INSERT INTO accounts VALUES (3, 'Amira', 200);
      UPDATE accounts SET balance = balance + 100 WHERE id = 2;
      `,
      { atomic: true, stopOnError: false }
    );

    expect(result).toMatchObject({ atomic: true, committed: false, rolledBack: true, failed: 1 });
    expect(result.statements.map((record) => record.status)).toEqual(["success", "error", "success"]);
    expect(accounts(database).rows).toEqual([
      { id: 1, owner: "Amira", balance: 1000 },
      { id: 2, owner: "Maya", balance: 500 }
    ]);
  });

  it("rolls back failed atomic scripts and skips later statements with stopOnError", () => {
    const database = createAccountsDatabase();
    const result = executeSqlScript(
      database,
      "UPDATE accounts SET balance = balance - 100 WHERE id = 1; INSERT INTO accounts VALUES (3, 'Amira', 200); UPDATE accounts SET balance = balance + 100 WHERE id = 2;",
      { atomic: true, stopOnError: true }
    );

    expect(result).toMatchObject({ atomic: true, committed: false, rolledBack: true, failed: 1, skipped: 1 });
    expect(result.statements.map((record) => record.status)).toEqual(["success", "error", "skipped"]);
    expect(accounts(database).rows).toEqual([
      { id: 1, owner: "Amira", balance: 1000 },
      { id: 2, owner: "Maya", balance: 500 }
    ]);
  });

  it("rejects explicit transaction commands in atomic scripts and atomic scripts inside active transactions", () => {
    const database = createAccountsDatabase();
    const explicitTransactionResult = executeSqlScript(database, "BEGIN; INSERT INTO accounts VALUES (3, 'Sara', 800);", { atomic: true });
    expect(explicitTransactionResult).toMatchObject({ atomic: true, rolledBack: true });
    expect(explicitTransactionResult.statements.map((record) => record.status)).toEqual(["error", "skipped"]);
    expect(explicitTransactionResult.statements[0]?.error).toMatchObject({ code: "TRANSACTION_CONTROL_NOT_ALLOWED" });

    executeSql(database, "BEGIN;");
    expect(executeSqlScript(database, "INSERT INTO accounts VALUES (3, 'Sara', 800);", { atomic: true })).toMatchObject({
      atomic: true,
      rolledBack: true,
      statements: [{ status: "error", error: { code: "ATOMIC_SCRIPT_IN_ACTIVE_TRANSACTION" } }]
    });
    expect(database.transactionState).toBe("ACTIVE");
    executeSql(database, "ROLLBACK;");
  });

  it("records transaction history without rolling it back", () => {
    const database = createAccountsDatabase();
    const history = new ExecutionHistory();
    const executor = new ScriptExecutor(database, history);

    executor.execute("BEGIN; INSERT INTO accounts VALUES (3, 'Sara', 800); ROLLBACK;");
    const listed = history.list();
    listed[0]!.statements[1]!.status = "skipped";

    expect(history.latest()?.statements.map((record) => record.statementType)).toEqual([
      "begin_transaction",
      "insert",
      "rollback_transaction"
    ]);
    expect(history.latest()?.statements.map((record) => record.status)).toEqual(["success", "success", "success"]);
    expect(accounts(database).rows).toEqual([
      { id: 1, owner: "Amira", balance: 1000 },
      { id: 2, owner: "Maya", balance: 500 }
    ]);
  });
});
