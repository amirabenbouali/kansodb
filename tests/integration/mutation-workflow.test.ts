import { describe, expect, it } from "vitest";
import { Database, ExecutionError, executeSql } from "../../src/index.js";

function createWorkflowDatabase(): Database {
  const database = new Database();
  executeSql(
    database,
    `
    CREATE TABLE employees (
      id INTEGER,
      name TEXT,
      department TEXT,
      salary DECIMAL NULL,
      active BOOLEAN
    );
    `
  );
  executeSql(database, "INSERT INTO employees VALUES (1, 'Amira', 'Engineering', 48000, TRUE);");
  executeSql(database, "INSERT INTO employees VALUES (2, 'Maya', 'Design', 42000.5, TRUE);");
  executeSql(database, "INSERT INTO employees VALUES (3, 'Noah', 'Engineering', 52000, TRUE);");
  return database;
}

describe("mutation workflow integration", () => {
  it("executes CREATE, INSERT, UPDATE, DELETE, and SELECT as separate calls", () => {
    const database = createWorkflowDatabase();

    const updateResult = executeSql(
      database,
      `
      UPDATE employees
      SET salary = 55000, active = FALSE
      WHERE name = 'Noah';
      `
    );

    const deleteResult = executeSql(
      database,
      `
      DELETE FROM employees
      WHERE active = FALSE;
      `
    );

    const queryResult = executeSql(
      database,
      `
      SELECT id, name, salary
      FROM employees
      ORDER BY id ASC;
      `
    );

    expect(updateResult).toEqual({ type: "update", tableName: "employees", affectedRows: 1 });
    expect(deleteResult).toEqual({ type: "delete", tableName: "employees", affectedRows: 1 });
    expect(queryResult).toEqual({
      type: "query",
      columns: ["id", "name", "salary"],
      rows: [
        { id: 1, name: "Amira", salary: 48000 },
        { id: 2, name: "Maya", salary: 42000.5 }
      ],
      rowCount: 2
    });
  });

  it("does not partially mutate rows when an update fails", () => {
    const database = createWorkflowDatabase();
    const before = database.getTable("employees").getRows();

    expect(() => executeSql(database, "UPDATE employees SET id = 1.5 WHERE department = 'Engineering';")).toThrow(ExecutionError);
    expect(database.getTable("employees").getRows()).toEqual(before);
    expect(executeSql(database, "SELECT * FROM employees ORDER BY id ASC")).toEqual({
      type: "query",
      columns: ["id", "name", "department", "salary", "active"],
      rows: before,
      rowCount: 3
    });
  });

  it("rejects multi-statement mutation strings", () => {
    const database = createWorkflowDatabase();

    expect(() => executeSql(database, "UPDATE employees SET active = FALSE; DELETE FROM employees WHERE active = FALSE;")).toThrow();
  });
});
