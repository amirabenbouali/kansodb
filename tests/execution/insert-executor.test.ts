import { describe, expect, it } from "vitest";
import { Database, DataType, ExecutionError, executeSql } from "../../src/index.js";

function createEmployeesDatabase(): Database {
  const database = new Database();
  executeSql(
    database,
    "CREATE TABLE employees (id INTEGER, name TEXT, department TEXT, salary DECIMAL NULL, active BOOLEAN)"
  );
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

describe("positional INSERT execution", () => {
  it("inserts one valid row", () => {
    const database = createEmployeesDatabase();

    expect(executeSql(database, "INSERT INTO employees VALUES (1, 'Amira', 'Engineering', 48000, TRUE)")).toEqual({
      type: "insert",
      tableName: "employees",
      affectedRows: 1
    });
  });

  it("maps values by schema order", () => {
    const database = createEmployeesDatabase();
    executeSql(database, "INSERT INTO employees VALUES (1, 'Amira', 'Engineering', 48000, TRUE)");

    expect(database.getTable("employees").getRows()[0]).toEqual({
      id: 1,
      name: "Amira",
      department: "Engineering",
      salary: 48000,
      active: true
    });
  });

  it("supports every storage type", () => {
    const database = createEmployeesDatabase();
    executeSql(database, "INSERT INTO employees VALUES (1, 'Amira', 'Engineering', 48000.5, FALSE)");

    expect(database.getTable("employees").getRows()[0]).toMatchObject({
      id: 1,
      name: "Amira",
      department: "Engineering",
      salary: 48000.5,
      active: false
    });
  });

  it("supports nullable values", () => {
    const database = createEmployeesDatabase();
    executeSql(database, "INSERT INTO employees VALUES (1, 'Amira', 'Engineering', NULL, TRUE)");

    expect(database.getTable("employees").getRows()[0]?.salary).toBeNull();
  });

  it("rejects too few values", () => {
    expectExecutionError(() => executeSql(createEmployeesDatabase(), "INSERT INTO employees VALUES (1, 'Amira')"), "VALUE_COUNT_MISMATCH");
  });

  it("rejects too many values", () => {
    expectExecutionError(
      () => executeSql(createEmployeesDatabase(), "INSERT INTO employees VALUES (1, 'Amira', 'Engineering', 1, TRUE, 9)"),
      "VALUE_COUNT_MISMATCH"
    );
  });

  it("rejects type mismatches", () => {
    expectExecutionError(
      () => executeSql(createEmployeesDatabase(), "INSERT INTO employees VALUES ('1', 'Amira', 'Engineering', 1, TRUE)"),
      "TYPE_MISMATCH"
    );
  });

  it("rejects null constraint violations", () => {
    expectExecutionError(
      () => executeSql(createEmployeesDatabase(), "INSERT INTO employees VALUES (1, NULL, 'Engineering', 1, TRUE)"),
      "NULL_CONSTRAINT"
    );
  });

  it("rejects unknown tables", () => {
    expectExecutionError(() => executeSql(new Database(), "INSERT INTO employees VALUES (1)"), "TABLE_NOT_FOUND");
  });
});

describe("named-column INSERT execution", () => {
  it("inserts one valid row", () => {
    const database = createEmployeesDatabase();
    executeSql(database, "INSERT INTO employees (id, name, department, salary, active) VALUES (1, 'Amira', 'Engineering', 48000, TRUE)");

    expect(database.getTable("employees").rowCount()).toBe(1);
  });

  it("supports reordered columns", () => {
    const database = createEmployeesDatabase();
    executeSql(database, "INSERT INTO employees (name, id, department, active, salary) VALUES ('Amira', 1, 'Engineering', TRUE, 48000)");

    expect(database.getTable("employees").getRows()[0]).toEqual({
      id: 1,
      name: "Amira",
      department: "Engineering",
      salary: 48000,
      active: true
    });
  });

  it("resolves columns case-insensitively", () => {
    const database = createEmployeesDatabase();
    executeSql(database, "INSERT INTO employees (ID, NAME, DEPARTMENT, SALARY, ACTIVE) VALUES (1, 'Amira', 'Engineering', 48000, TRUE)");

    expect(database.getTable("employees").getRows()[0]?.name).toBe("Amira");
  });

  it("uses original schema names", () => {
    const database = new Database();
    executeSql(database, "CREATE TABLE employees (EmployeeId INTEGER, EmployeeName TEXT)");
    executeSql(database, "INSERT INTO employees (employeeid, employeename) VALUES (1, 'Amira')");

    expect(database.getTable("employees").getRows()[0]).toEqual({ EmployeeId: 1, EmployeeName: "Amira" });
  });

  it("stores omitted nullable columns as null", () => {
    const database = createEmployeesDatabase();
    executeSql(database, "INSERT INTO employees (id, name, department, active) VALUES (1, 'Amira', 'Engineering', TRUE)");

    expect(database.getTable("employees").getRows()[0]?.salary).toBeNull();
  });

  it("rejects omitted required columns", () => {
    expectExecutionError(
      () => executeSql(createEmployeesDatabase(), "INSERT INTO employees (id, name, active) VALUES (1, 'Amira', TRUE)"),
      "INVALID_STATEMENT"
    );
  });

  it("rejects unknown columns", () => {
    expectExecutionError(
      () => executeSql(createEmployeesDatabase(), "INSERT INTO employees (id, unknown) VALUES (1, 'x')"),
      "COLUMN_NOT_FOUND"
    );
  });

  it("rejects duplicate columns", () => {
    expectExecutionError(
      () => executeSql(createEmployeesDatabase(), "INSERT INTO employees (id, id) VALUES (1, 2)"),
      "DUPLICATE_COLUMN"
    );
  });

  it("rejects case-insensitive duplicate columns", () => {
    expectExecutionError(
      () => executeSql(createEmployeesDatabase(), "INSERT INTO employees (id, ID) VALUES (1, 2)"),
      "DUPLICATE_COLUMN"
    );
  });

  it("rejects too few values", () => {
    expectExecutionError(
      () => executeSql(createEmployeesDatabase(), "INSERT INTO employees (id, name) VALUES (1)"),
      "COLUMN_VALUE_COUNT_MISMATCH"
    );
  });

  it("rejects too many values", () => {
    expectExecutionError(
      () => executeSql(createEmployeesDatabase(), "INSERT INTO employees (id) VALUES (1, 2)"),
      "COLUMN_VALUE_COUNT_MISMATCH"
    );
  });

  it("rejects type mismatches", () => {
    expectExecutionError(
      () =>
        executeSql(
          createEmployeesDatabase(),
          "INSERT INTO employees (id, name, department, salary, active) VALUES ('1', 'Amira', 'Engineering', 1, TRUE)"
        ),
      "TYPE_MISMATCH"
    );
  });

  it("rejects null constraint violations", () => {
    expectExecutionError(
      () =>
        executeSql(
          createEmployeesDatabase(),
          "INSERT INTO employees (id, name, department, salary, active) VALUES (1, NULL, 'Engineering', 1, TRUE)"
        ),
      "NULL_CONSTRAINT"
    );
  });

  it("keeps existing SELECT queries working", () => {
    const database = createEmployeesDatabase();
    executeSql(database, "INSERT INTO employees VALUES (1, 'Amira', 'Engineering', 48000, TRUE)");

    expect(executeSql(database, "SELECT name FROM employees")).toEqual({
      type: "query",
      columns: ["name"],
      rows: [{ name: "Amira" }],
      rowCount: 1
    });
  });

  it("creates table and selects inserted rows through SQL", () => {
    const database = new Database();
    expect(executeSql(database, "CREATE TABLE flags (id INTEGER, active BOOLEAN)")).toEqual({
      type: "create_table",
      tableName: "flags",
      columnCount: 2
    });
    expect(executeSql(database, "INSERT INTO flags VALUES (1, TRUE)")).toEqual({
      type: "insert",
      tableName: "flags",
      affectedRows: 1
    });
    expect(executeSql(database, "SELECT active FROM flags")).toEqual({
      type: "query",
      columns: ["active"],
      rows: [{ active: true }],
      rowCount: 1
    });
  });
});
