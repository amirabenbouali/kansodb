import { describe, expect, it } from "vitest";
import { Database, ExecutionError, TransactionError, executeSql } from "../../src/index.js";

function createAccountsDatabase(): Database {
  const database = new Database();
  executeSql(database, "CREATE TABLE accounts (id INTEGER PRIMARY KEY, owner TEXT NOT NULL UNIQUE, balance DECIMAL NOT NULL);");
  executeSql(database, "INSERT INTO accounts VALUES (1, 'Amira', 1000);");
  executeSql(database, "INSERT INTO accounts VALUES (2, 'Maya', 500);");
  return database;
}

function expectTransactionError(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error("Expected transaction action to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(TransactionError);
    expect(error).toMatchObject({ code });
  }
}

describe("transaction statement execution", () => {
  it("executes BEGIN, COMMIT, and ROLLBACK results", () => {
    const database = createAccountsDatabase();

    expect(executeSql(database, "BEGIN;")).toEqual({ type: "transaction", action: "BEGIN", state: "ACTIVE" });
    expect(executeSql(database, "COMMIT;")).toEqual({ type: "transaction", action: "COMMIT", state: "IDLE" });
    expect(executeSql(database, "BEGIN TRANSACTION;")).toEqual({ type: "transaction", action: "BEGIN", state: "ACTIVE" });
    expect(executeSql(database, "ROLLBACK;")).toEqual({ type: "transaction", action: "ROLLBACK", state: "IDLE" });
  });

  it("commits inserted, updated, deleted, and created table changes", () => {
    const database = createAccountsDatabase();
    executeSql(database, "BEGIN;");
    executeSql(database, "INSERT INTO accounts VALUES (3, 'Sara', 800);");
    executeSql(database, "UPDATE accounts SET balance = balance + 100 WHERE id = 1;");
    executeSql(database, "DELETE FROM accounts WHERE id = 2;");
    executeSql(database, "CREATE TABLE audit_log (id INTEGER PRIMARY KEY, message TEXT NOT NULL);");
    executeSql(database, "COMMIT;");

    expect(executeSql(database, "SELECT id, owner, balance FROM accounts ORDER BY id ASC;")).toMatchObject({
      rows: [
        { id: 1, owner: "Amira", balance: 1100 },
        { id: 3, owner: "Sara", balance: 800 }
      ]
    });
    expect(database.hasTable("audit_log")).toBe(true);
  });

  it("rolls back inserted, updated, deleted, and created table changes", () => {
    const database = createAccountsDatabase();
    executeSql(database, "BEGIN;");
    executeSql(database, "UPDATE accounts SET balance = balance - 250 WHERE id = 1;");
    executeSql(database, "DELETE FROM accounts WHERE id = 2;");
    executeSql(database, "INSERT INTO accounts VALUES (3, 'Sara', 800);");
    executeSql(database, "CREATE TABLE audit_log (id INTEGER PRIMARY KEY);");
    executeSql(database, "ROLLBACK;");

    expect(executeSql(database, "SELECT id, owner, balance FROM accounts ORDER BY id ASC;")).toMatchObject({
      rows: [
        { id: 1, owner: "Amira", balance: 1000 },
        { id: 2, owner: "Maya", balance: 500 }
      ]
    });
    expect(database.hasTable("audit_log")).toBe(false);
  });

  it("keeps transactions active and statement-atomic after failures", () => {
    const database = createAccountsDatabase();
    executeSql(database, "BEGIN;");
    executeSql(database, "UPDATE accounts SET balance = balance + 100 WHERE id = 1;");

    expect(() => executeSql(database, "INSERT INTO accounts VALUES (3, 'Amira', 200);")).toThrow(ExecutionError);
    expect(database.transactionState).toBe("ACTIVE");
    expect(executeSql(database, "SELECT id, owner, balance FROM accounts ORDER BY id ASC;")).toMatchObject({
      rows: [
        { id: 1, owner: "Amira", balance: 1100 },
        { id: 2, owner: "Maya", balance: 500 }
      ]
    });

    executeSql(database, "ROLLBACK;");
    expect(database.transactionState).toBe("IDLE");
    expect(executeSql(database, "SELECT id, owner, balance FROM accounts ORDER BY id ASC;")).toMatchObject({
      rows: [
        { id: 1, owner: "Amira", balance: 1000 },
        { id: 2, owner: "Maya", balance: 500 }
      ]
    });
  });

  it("queries see transaction-local inserts, updates, deletes, joins, and aggregates", () => {
    const database = new Database();
    executeSql(database, "CREATE TABLE departments (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);");
    executeSql(database, "CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT NOT NULL, department_id INTEGER NULL, salary DECIMAL NOT NULL, FOREIGN KEY (department_id) REFERENCES departments(id));");
    executeSql(database, "INSERT INTO departments VALUES (1, 'Engineering');");
    executeSql(database, "INSERT INTO employees VALUES (1, 'Amira', 1, 100);");

    executeSql(database, "BEGIN;");
    executeSql(database, "INSERT INTO departments VALUES (2, 'Research');");
    executeSql(database, "INSERT INTO employees VALUES (2, 'Sara', 2, 200);");
    executeSql(database, "UPDATE employees SET salary = salary + 50 WHERE id = 1;");
    executeSql(database, "DELETE FROM employees WHERE id = 2;");

    expect(executeSql(database, "SELECT COUNT(*) AS total, SUM(salary) AS payroll FROM employees;")).toMatchObject({
      rows: [{ total: 1, payroll: 150 }]
    });
    expect(executeSql(database, "SELECT e.name AS employee, d.name AS department FROM employees e LEFT JOIN departments d ON e.department_id = d.id;")).toMatchObject({
      rows: [{ employee: "Amira", department: "Engineering" }]
    });

    executeSql(database, "ROLLBACK;");
    expect(executeSql(database, "SELECT COUNT(*) AS total, SUM(salary) AS payroll FROM employees;")).toMatchObject({
      rows: [{ total: 1, payroll: 100 }]
    });
  });

  it("enforces transaction command state errors", () => {
    const database = createAccountsDatabase();

    expectTransactionError(() => executeSql(database, "COMMIT;"), "NO_ACTIVE_TRANSACTION");
    expectTransactionError(() => executeSql(database, "ROLLBACK;"), "NO_ACTIVE_TRANSACTION");
    executeSql(database, "BEGIN;");
    expectTransactionError(() => executeSql(database, "BEGIN;"), "TRANSACTION_ALREADY_ACTIVE");
  });
});
