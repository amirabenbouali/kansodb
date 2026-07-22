import { describe, expect, it } from "vitest";
import { Database, ExecutionError, executeSql, type QueryResult } from "../../src/index.js";

function createDatabase(): Database {
  const database = new Database();
  executeSql(database, "CREATE TABLE employees (id INTEGER, name TEXT, department TEXT, salary DECIMAL NULL, bonus DECIMAL NULL, active BOOLEAN)");
  executeSql(database, "INSERT INTO employees VALUES (1, 'Amira', 'Engineering', 48000, 2000, TRUE)");
  executeSql(database, "INSERT INTO employees VALUES (2, 'Maya', 'Design', 42000.5, 1500, TRUE)");
  executeSql(database, "INSERT INTO employees VALUES (3, 'Noah', 'Engineering', 52000, NULL, FALSE)");
  executeSql(database, "INSERT INTO employees VALUES (4, 'Lina', 'Engineering', 45000, 1000, TRUE)");
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

function executeQuery(database: Database, sql: string): QueryResult {
  const result = executeSql(database, sql);
  expect(result.type).toBe("query");
  return result as QueryResult;
}

describe("computed projection and ordering", () => {
  it("projects computed columns with deterministic names and aliases", () => {
    const result = executeQuery(createDatabase(), "SELECT salary + bonus, salary * 1.1 AS adjusted_salary FROM employees WHERE id = 1");

    expect(result).toMatchObject({
      type: "query",
      columns: ["salary + bonus", "adjusted_salary"],
      rowCount: 1
    });
    expect(result.rows[0]?.["salary + bonus"]).toBe(50000);
    expect(Number(result.rows[0]?.adjusted_salary)).toBeCloseTo(52800);
  });

  it("propagates nulls through arithmetic projection", () => {
    expect(executeSql(createDatabase(), "SELECT salary + bonus AS total FROM employees WHERE name = 'Noah'")).toMatchObject({
      rows: [{ total: null }]
    });
  });

  it("orders by result aliases and select-list ordinals", () => {
    const result = executeQuery(createDatabase(), "SELECT name AS employee, salary * 1.1 AS adjusted FROM employees ORDER BY adjusted DESC, 1 ASC LIMIT 2");

    expect(result).toMatchObject({
      columns: ["employee", "adjusted"],
      rowCount: 2
    });
    expect(result.rows[0]?.employee).toBe("Noah");
    expect(Number(result.rows[0]?.adjusted)).toBeCloseTo(57200);
    expect(result.rows[1]?.employee).toBe("Amira");
    expect(Number(result.rows[1]?.adjusted)).toBeCloseTo(52800);
  });

  it("uses source columns when an unqualified ORDER BY name is not a result alias", () => {
    expect(executeSql(createDatabase(), "SELECT name FROM employees ORDER BY salary DESC LIMIT 2")).toMatchObject({
      rows: [{ name: "Noah" }, { name: "Amira" }]
    });
  });

  it("prefers result aliases over source columns", () => {
    expect(executeSql(createDatabase(), "SELECT name AS salary FROM employees ORDER BY salary ASC LIMIT 1")).toMatchObject({
      rows: [{ salary: "Amira" }]
    });
  });

  it("rejects duplicate aliases, duplicate output names, and bad ordinals", () => {
    expectExecutionError(() => executeSql(createDatabase(), "SELECT name AS x, salary AS x FROM employees"), "DUPLICATE_ALIAS");
    expectExecutionError(() => executeSql(createDatabase(), "SELECT name AS salary, salary FROM employees"), "DUPLICATE_COLUMN");
    expectExecutionError(() => executeSql(createDatabase(), "SELECT name FROM employees ORDER BY 2"), "ORDER_BY_POSITION_OUT_OF_RANGE");
  });

  it("rejects invalid arithmetic operands", () => {
    expectExecutionError(() => executeSql(createDatabase(), "SELECT name + 1 FROM employees"), "INVALID_OPERAND_TYPE");
    expectExecutionError(() => executeSql(createDatabase(), "SELECT salary / 0 FROM employees"), "DIVISION_BY_ZERO");
    expectExecutionError(() => executeSql(createDatabase(), "SELECT salary % 0 FROM employees"), "MODULO_BY_ZERO");
  });
});
