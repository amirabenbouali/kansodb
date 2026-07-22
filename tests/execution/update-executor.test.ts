import { describe, expect, it } from "vitest";
import { Database, ExecutionError, executeSql } from "../../src/index.js";

function createDatabase(): Database {
  const database = new Database();
  executeSql(database, "CREATE TABLE employees (id INTEGER, name TEXT, department TEXT, salary DECIMAL NULL, active BOOLEAN)");
  executeSql(database, "INSERT INTO employees VALUES (1, 'Amira', 'Engineering', 48000, TRUE)");
  executeSql(database, "INSERT INTO employees VALUES (2, 'Maya', 'Design', 42000.5, TRUE)");
  executeSql(database, "INSERT INTO employees VALUES (3, 'Noah', 'Engineering', 52000, TRUE)");
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

describe("UPDATE execution", () => {
  it("updates one row", () => {
    const database = createDatabase();

    expect(executeSql(database, "UPDATE employees SET salary = 50000 WHERE id = 1")).toEqual({
      type: "update",
      tableName: "employees",
      affectedRows: 1
    });
    expect(database.getTable("employees").getRows()[0]?.salary).toBe(50000);
  });

  it("updates multiple rows and every row without WHERE", () => {
    const database = createDatabase();

    expect(executeSql(database, "UPDATE employees SET active = FALSE WHERE department = 'Engineering'")).toMatchObject({ affectedRows: 2 });
    expect(executeSql(database, "UPDATE employees SET department = 'People'")).toMatchObject({ affectedRows: 3 });
  });

  it("updates zero rows and multiple columns", () => {
    const database = createDatabase();

    expect(executeSql(database, "UPDATE employees SET salary = 1 WHERE id = 99")).toMatchObject({ affectedRows: 0 });
    expect(executeSql(database, "UPDATE employees SET salary = 50000, active = FALSE WHERE id = 1")).toMatchObject({ affectedRows: 1 });
    expect(database.getTable("employees").getRows()[0]).toMatchObject({ salary: 50000, active: false });
  });

  it("resolves table and assignment columns case-insensitively while preserving schema keys", () => {
    const database = createDatabase();
    executeSql(database, "UPDATE EMPLOYEES SET SALARY = 50000 WHERE ID = 1");

    expect(database.getTable("employees").getRows()[0]).toMatchObject({ salary: 50000 });
    expect(Object.keys(database.getTable("employees").getRows()[0]!)).toEqual(["id", "name", "department", "salary", "active"]);
  });

  it("supports literal assignment types", () => {
    const database = createDatabase();
    executeSql(database, "UPDATE employees SET id = 10, salary = 10.5, name = 'A', active = FALSE WHERE id = 1");

    expect(database.getTable("employees").getRows()[0]).toMatchObject({ id: 10, salary: 10.5, name: "A", active: false });
  });

  it("supports nullable assignment", () => {
    const database = createDatabase();
    executeSql(database, "UPDATE employees SET salary = NULL WHERE id = 1");

    expect(database.getTable("employees").getRows()[0]?.salary).toBeNull();
  });

  it("supports arithmetic assignments", () => {
    const database = createDatabase();

    expect(executeSql(database, "UPDATE employees SET salary = salary + 2500 WHERE id = 1")).toMatchObject({ affectedRows: 1 });
    expect(executeSql(database, "UPDATE employees SET salary = salary * 1.1 WHERE id = 2")).toMatchObject({ affectedRows: 1 });
    expect(executeSql(database, "UPDATE employees SET salary = salary / 2 WHERE id = 3")).toMatchObject({ affectedRows: 1 });

    expect(database.getTable("employees").getRows()).toMatchObject([
      { name: "Amira", salary: 50500 },
      { name: "Maya", salary: 46200.55 },
      { name: "Noah", salary: 26000 }
    ]);
  });

  it("uses original row values for multiple assignments", () => {
    const database = new Database();
    executeSql(database, "CREATE TABLE numbers (a INTEGER, b INTEGER)");
    executeSql(database, "INSERT INTO numbers VALUES (1, 2)");

    executeSql(database, "UPDATE numbers SET a = b, b = a");

    expect(database.getTable("numbers").getRows()).toEqual([{ a: 2, b: 1 }]);
  });

  it("is atomic for arithmetic failures", () => {
    const database = createDatabase();
    const before = database.getTable("employees").getRows();

    expectExecutionError(() => executeSql(database, "UPDATE employees SET salary = salary / 0 WHERE department = 'Engineering'"), "DIVISION_BY_ZERO");
    expect(database.getTable("employees").getRows()).toEqual(before);
    expectExecutionError(() => executeSql(database, "UPDATE employees SET id = id / 2"), "TYPE_MISMATCH");
    expect(database.getTable("employees").getRows()).toEqual(before);
  });

  it("rejects unknown table, columns, and duplicates", () => {
    expectExecutionError(() => executeSql(new Database(), "UPDATE employees SET salary = 1"), "TABLE_NOT_FOUND");
    expectExecutionError(() => executeSql(createDatabase(), "UPDATE employees SET missing = 1"), "COLUMN_NOT_FOUND");
    expectExecutionError(() => executeSql(createDatabase(), "UPDATE employees SET salary = 1, salary = 2"), "DUPLICATE_COLUMN");
    expectExecutionError(() => executeSql(createDatabase(), "UPDATE employees SET salary = 1, SALARY = 2"), "DUPLICATE_COLUMN");
    expectExecutionError(() => executeSql(createDatabase(), "UPDATE employees SET salary = 1 WHERE missing = 2"), "COLUMN_NOT_FOUND");
  });

  it("rejects type mismatches, null constraints, and coercion", () => {
    expectExecutionError(() => executeSql(createDatabase(), "UPDATE employees SET id = 1.5"), "TYPE_MISMATCH");
    expectExecutionError(() => executeSql(createDatabase(), "UPDATE employees SET id = NULL"), "NOT_NULL_VIOLATION");
    expectExecutionError(() => executeSql(createDatabase(), "UPDATE employees SET id = '1'"), "TYPE_MISMATCH");
  });

  it("supports WHERE with AND, OR, and parentheses", () => {
    const database = createDatabase();
    executeSql(database, "UPDATE employees SET active = FALSE WHERE department = 'Engineering' AND id = 1");
    executeSql(database, "UPDATE employees SET salary = 1 WHERE name = 'Maya' OR name = 'Noah'");
    executeSql(database, "UPDATE employees SET department = 'X' WHERE (name = 'Maya' OR name = 'Noah') AND salary = 1");

    expect(database.getTable("employees").getRows()).toMatchObject([
      { active: false, department: "Engineering" },
      { salary: 1, department: "X" },
      { salary: 1, department: "X" }
    ]);
  });

  it("uses three-valued logic in UPDATE predicates", () => {
    const database = createDatabase();
    executeSql(database, "UPDATE employees SET salary = NULL WHERE id = 3");

    expect(executeSql(database, "UPDATE employees SET active = FALSE WHERE salary > NULL")).toMatchObject({ affectedRows: 0 });
    expect(executeSql(database, "UPDATE employees SET active = FALSE WHERE salary IS NULL")).toMatchObject({ affectedRows: 1 });
    expect(database.getTable("employees").getRows()[2]).toMatchObject({ active: false });
  });

  it("is atomic for one or multiple matching rows", () => {
    const database = createDatabase();
    const before = database.getTable("employees").getRows();

    expectExecutionError(() => executeSql(database, "UPDATE employees SET id = 1.5 WHERE id = 1"), "TYPE_MISMATCH");
    expect(database.getTable("employees").getRows()).toEqual(before);
    expectExecutionError(() => executeSql(database, "UPDATE employees SET id = 1.5 WHERE department = 'Engineering'"), "TYPE_MISMATCH");
    expect(database.getTable("employees").getRows()).toEqual(before);
  });

  it("makes subsequent SELECT see updated values", () => {
    const database = createDatabase();
    executeSql(database, "UPDATE employees SET salary = 50000 WHERE id = 1");

    expect(executeSql(database, "SELECT name, salary FROM employees WHERE id = 1")).toEqual({
      type: "query",
      columns: ["name", "salary"],
      rows: [{ name: "Amira", salary: 50000 }],
      rowCount: 1
    });
  });
});
