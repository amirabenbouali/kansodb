import { describe, expect, it } from "vitest";
import { Database, ExecutionError, executeSql } from "../../src/index.js";

function createDatabase(): Database {
  const database = new Database();
  executeSql(database, "CREATE TABLE employees (id INTEGER, name TEXT, department TEXT, salary DECIMAL NULL, active BOOLEAN)");
  executeSql(database, "INSERT INTO employees VALUES (1, 'Amira', 'Engineering', 48000, TRUE)");
  executeSql(database, "INSERT INTO employees VALUES (2, 'Maya', 'Design', 42000.5, TRUE)");
  executeSql(database, "INSERT INTO employees VALUES (3, 'Noah', 'Engineering', NULL, FALSE)");
  return database;
}

function expectExecutionError(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error("Expected execution action to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(ExecutionError);
    expect(error).toMatchObject({ code });
  }
}

describe("DELETE execution", () => {
  it("deletes one row, multiple rows, every row, and zero rows", () => {
    const database = createDatabase();

    expect(executeSql(database, "DELETE FROM employees WHERE id = 2")).toEqual({
      type: "delete",
      tableName: "employees",
      affectedRows: 1
    });
    expect(executeSql(database, "DELETE FROM employees WHERE department = 'Engineering'")).toMatchObject({ affectedRows: 2 });
    expect(executeSql(database, "DELETE FROM employees WHERE id = 99")).toMatchObject({ affectedRows: 0 });
    expect(executeSql(database, "DELETE FROM employees")).toMatchObject({ affectedRows: 0 });
  });

  it("resolves table names case-insensitively", () => {
    expect(executeSql(createDatabase(), "DELETE FROM EMPLOYEES WHERE id = 1")).toMatchObject({ affectedRows: 1 });
  });

  it("rejects unknown tables and WHERE columns", () => {
    expectExecutionError(() => executeSql(new Database(), "DELETE FROM employees"), "TABLE_NOT_FOUND");
    expectExecutionError(() => executeSql(createDatabase(), "DELETE FROM employees WHERE missing = 1"), "COLUMN_NOT_FOUND");
  });

  it("supports WHERE comparisons and logical expressions", () => {
    expect(executeSql(createDatabase(), "DELETE FROM employees WHERE id > 1")).toMatchObject({ affectedRows: 2 });
    expect(executeSql(createDatabase(), "DELETE FROM employees WHERE name = 'Maya'")).toMatchObject({ affectedRows: 1 });
    expect(executeSql(createDatabase(), "DELETE FROM employees WHERE active = FALSE")).toMatchObject({ affectedRows: 1 });
    expect(executeSql(createDatabase(), "DELETE FROM employees WHERE salary = NULL")).toMatchObject({ affectedRows: 0 });
    expect(executeSql(createDatabase(), "DELETE FROM employees WHERE salary IS NULL")).toMatchObject({ affectedRows: 1 });
    expect(executeSql(createDatabase(), "DELETE FROM employees WHERE active = TRUE AND department = 'Engineering'")).toMatchObject({
      affectedRows: 1
    });
    expect(executeSql(createDatabase(), "DELETE FROM employees WHERE name = 'Maya' OR active = FALSE")).toMatchObject({ affectedRows: 2 });
    expect(executeSql(createDatabase(), "DELETE FROM employees WHERE (name = 'Maya' OR active = FALSE) AND id > 1")).toMatchObject({
      affectedRows: 2
    });
  });

  it("uses IS NULL and IS NOT NULL in DELETE predicates", () => {
    expect(executeSql(createDatabase(), "DELETE FROM employees WHERE salary IS NULL")).toMatchObject({ affectedRows: 1 });
    expect(executeSql(createDatabase(), "DELETE FROM employees WHERE salary IS NOT NULL")).toMatchObject({ affectedRows: 2 });
  });

  it("preserves remaining row order and hides deleted rows from later SELECT", () => {
    const database = createDatabase();
    executeSql(database, "DELETE FROM employees WHERE id = 2");

    expect(database.getTable("employees").getRows().map((row) => row.name)).toEqual(["Amira", "Noah"]);
    expect(executeSql(database, "SELECT name FROM employees")).toEqual({
      type: "query",
      columns: ["name"],
      rows: [{ name: "Amira" }, { name: "Noah" }],
      rowCount: 2
    });
  });
});
