import { describe, expect, it } from "vitest";
import { Database, DataType, ExecutionError, Executor, executeSql, type CreateTableStatement } from "../../src/index.js";

function expectExecutionError(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error("Expected execution action to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(ExecutionError);
    expect(error).toMatchObject({ code });
  }
}

describe("CREATE TABLE execution", () => {
  it("creates a table", () => {
    const database = new Database();
    executeSql(database, "CREATE TABLE employees (id INTEGER)");

    expect(database.hasTable("employees")).toBe(true);
  });

  it("creates the correct schema", () => {
    const database = new Database();
    executeSql(database, "CREATE TABLE employees (id INTEGER, name TEXT)");

    expect(database.getTable("employees").getSchema()).toEqual([
      { name: "id", type: DataType.INTEGER, nullable: false },
      { name: "name", type: DataType.TEXT, nullable: false }
    ]);
  });

  it("maps all parser data types correctly", () => {
    const database = new Database();
    executeSql(database, "CREATE TABLE t (a INTEGER, b DECIMAL, c TEXT, d BOOLEAN)");

    expect(database.getTable("t").getSchema().map((column) => column.type)).toEqual([
      DataType.INTEGER,
      DataType.DECIMAL,
      DataType.TEXT,
      DataType.BOOLEAN
    ]);
  });

  it("preserves nullability", () => {
    const database = new Database();
    executeSql(database, "CREATE TABLE t (a INTEGER NOT NULL, b DECIMAL NULL)");

    expect(database.getTable("t").getSchema()).toEqual([
      { name: "a", type: DataType.INTEGER, nullable: false },
      { name: "b", type: DataType.DECIMAL, nullable: true }
    ]);
  });

  it("returns the correct result", () => {
    expect(executeSql(new Database(), "CREATE TABLE employees (id INTEGER, name TEXT)")).toEqual({
      type: "create_table",
      tableName: "employees",
      columnCount: 2
    });
  });

  it("rejects duplicate tables", () => {
    const database = new Database();
    executeSql(database, "CREATE TABLE employees (id INTEGER)");

    expectExecutionError(() => executeSql(database, "CREATE TABLE employees (id INTEGER)"), "TABLE_ALREADY_EXISTS");
  });

  it("rejects duplicate columns", () => {
    expectExecutionError(() => executeSql(new Database(), "CREATE TABLE employees (id INTEGER, id TEXT)"), "DUPLICATE_COLUMN");
  });

  it("rejects case-insensitive duplicate columns", () => {
    expectExecutionError(() => executeSql(new Database(), "CREATE TABLE employees (id INTEGER, ID TEXT)"), "DUPLICATE_COLUMN");
  });

  it("propagates invalid table names as execution errors", () => {
    const statement: CreateTableStatement = {
      type: "create_table",
      tableName: "",
      columns: [{ name: "id", dataType: "INTEGER", nullable: false }]
    };

    expectExecutionError(() => new Executor(new Database()).execute(statement), "INVALID_STATEMENT");
  });

  it("propagates invalid column names as execution errors", () => {
    const statement: CreateTableStatement = {
      type: "create_table",
      tableName: "employees",
      columns: [{ name: "", dataType: "INTEGER", nullable: false }]
    };

    expectExecutionError(() => new Executor(new Database()).execute(statement), "COLUMN_NOT_FOUND");
  });
});
