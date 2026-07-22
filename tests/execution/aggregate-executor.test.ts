import { describe, expect, it } from "vitest";
import { Database, ExecutionError, ExecutionHistory, ScriptExecutor, executeSql } from "../../src/index.js";

function createEmployeesDatabase(): Database {
  const database = new Database();
  executeSql(database, "CREATE TABLE employees (id INTEGER, name TEXT, department TEXT NULL, salary DECIMAL NULL, active BOOLEAN)");
  executeSql(database, "INSERT INTO employees VALUES (1, 'Amira', 'Engineering', 48000, TRUE)");
  executeSql(database, "INSERT INTO employees VALUES (2, 'Maya', 'Design', 42000.5, TRUE)");
  executeSql(database, "INSERT INTO employees VALUES (3, 'Noah', 'Engineering', 52000, FALSE)");
  executeSql(database, "INSERT INTO employees VALUES (4, 'Lina', 'Engineering', NULL, TRUE)");
  executeSql(database, "INSERT INTO employees VALUES (5, 'Sara', NULL, 45000, TRUE)");
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

describe("aggregate execution", () => {
  it("executes COUNT variants", () => {
    const database = createEmployeesDatabase();

    expect(executeSql(database, "SELECT COUNT(*), COUNT(salary) FROM employees")).toEqual({
      type: "query",
      columns: ["COUNT(*)", "COUNT(salary)"],
      rows: [{ "COUNT(*)": 5, "COUNT(salary)": 4 }],
      rowCount: 1
    });
    expect(executeSql(database, "SELECT department, COUNT(*), COUNT(salary) FROM employees GROUP BY department")).toMatchObject({
      rowCount: 3,
      rows: [
        { department: "Engineering", "COUNT(*)": 3, "COUNT(salary)": 2 },
        { department: "Design", "COUNT(*)": 1, "COUNT(salary)": 1 },
        { department: null, "COUNT(*)": 1, "COUNT(salary)": 1 }
      ]
    });
  });

  it("handles COUNT on empty tables", () => {
    const database = new Database();
    executeSql(database, "CREATE TABLE employees (id INTEGER, salary DECIMAL NULL)");

    expect(executeSql(database, "SELECT COUNT(*), COUNT(salary) FROM employees")).toMatchObject({
      rows: [{ "COUNT(*)": 0, "COUNT(salary)": 0 }],
      rowCount: 1
    });
  });

  it("executes SUM and AVG semantics", () => {
    const database = createEmployeesDatabase();

    expect(executeSql(database, "SELECT SUM(id), SUM(salary), AVG(id), AVG(salary) FROM employees")).toEqual({
      type: "query",
      columns: ["SUM(id)", "SUM(salary)", "AVG(id)", "AVG(salary)"],
      rows: [{ "SUM(id)": 15, "SUM(salary)": 187000.5, "AVG(id)": 3, "AVG(salary)": 46750.125 }],
      rowCount: 1
    });
    expect(executeSql(database, "SELECT department, SUM(salary), AVG(salary) FROM employees GROUP BY department")).toMatchObject({
      rows: [
        { department: "Engineering", "SUM(salary)": 100000, "AVG(salary)": 50000 },
        { department: "Design", "SUM(salary)": 42000.5, "AVG(salary)": 42000.5 },
        { department: null, "SUM(salary)": 45000, "AVG(salary)": 45000 }
      ]
    });
  });

  it("returns null for all-null and empty SUM/AVG inputs", () => {
    const database = new Database();
    executeSql(database, "CREATE TABLE employees (id INTEGER, salary DECIMAL NULL)");
    executeSql(database, "INSERT INTO employees VALUES (1, NULL)");

    expect(executeSql(database, "SELECT SUM(salary), AVG(salary) FROM employees")).toMatchObject({
      rows: [{ "SUM(salary)": null, "AVG(salary)": null }]
    });
    expect(executeSql(database, "SELECT SUM(salary), AVG(salary) FROM employees WHERE id = 99")).toMatchObject({
      rows: [{ "SUM(salary)": null, "AVG(salary)": null }]
    });
  });

  it("rejects invalid SUM and AVG column types", () => {
    expectExecutionError(() => executeSql(createEmployeesDatabase(), "SELECT SUM(name) FROM employees"), "INVALID_AGGREGATE_TYPE");
    expectExecutionError(() => executeSql(createEmployeesDatabase(), "SELECT SUM(active) FROM employees"), "INVALID_AGGREGATE_TYPE");
    expectExecutionError(() => executeSql(createEmployeesDatabase(), "SELECT AVG(name) FROM employees"), "INVALID_AGGREGATE_TYPE");
    expectExecutionError(() => executeSql(createEmployeesDatabase(), "SELECT AVG(active) FROM employees"), "INVALID_AGGREGATE_TYPE");
  });

  it("executes MIN and MAX semantics", () => {
    const database = createEmployeesDatabase();

    expect(executeSql(database, "SELECT MIN(salary), MAX(salary), MIN(name), MAX(name), MIN(active), MAX(active) FROM employees")).toEqual({
      type: "query",
      columns: ["MIN(salary)", "MAX(salary)", "MIN(name)", "MAX(name)", "MIN(active)", "MAX(active)"],
      rows: [
        {
          "MIN(salary)": 42000.5,
          "MAX(salary)": 52000,
          "MIN(name)": "Amira",
          "MAX(name)": "Sara",
          "MIN(active)": false,
          "MAX(active)": true
        }
      ],
      rowCount: 1
    });
    expect(executeSql(database, "SELECT department, MIN(salary), MAX(salary) FROM employees GROUP BY department")).toMatchObject({
      rows: [
        { department: "Engineering", "MIN(salary)": 48000, "MAX(salary)": 52000 },
        { department: "Design", "MIN(salary)": 42000.5, "MAX(salary)": 42000.5 },
        { department: null, "MIN(salary)": 45000, "MAX(salary)": 45000 }
      ]
    });
  });

  it("returns null for all-null and empty MIN/MAX inputs", () => {
    const database = new Database();
    executeSql(database, "CREATE TABLE employees (id INTEGER, salary DECIMAL NULL)");
    executeSql(database, "INSERT INTO employees VALUES (1, NULL)");

    expect(executeSql(database, "SELECT MIN(salary), MAX(salary) FROM employees")).toMatchObject({
      rows: [{ "MIN(salary)": null, "MAX(salary)": null }]
    });
    expect(executeSql(database, "SELECT MIN(salary), MAX(salary) FROM employees WHERE id = 99")).toMatchObject({
      rows: [{ "MIN(salary)": null, "MAX(salary)": null }]
    });
  });

  it("supports grouping behavior and validation", () => {
    const database = createEmployeesDatabase();

    expect(executeSql(database, "SELECT department FROM employees GROUP BY department")).toMatchObject({
      rows: [{ department: "Engineering" }, { department: "Design" }, { department: null }]
    });
    expect(executeSql(database, "SELECT department, active, COUNT(*) FROM employees GROUP BY department, active")).toMatchObject({
      rowCount: 4
    });
    expect(executeSql(database, "SELECT department, COUNT(*) FROM employees WHERE active = TRUE GROUP BY department ORDER BY department ASC")).toMatchObject({
      rows: [
        { department: "Design", "COUNT(*)": 1 },
        { department: "Engineering", "COUNT(*)": 2 },
        { department: null, "COUNT(*)": 1 }
      ]
    });
    expect(executeSql(database, "SELECT DEPARTMENT, COUNT(*) FROM employees GROUP BY department")).toMatchObject({
      columns: ["department", "COUNT(*)"]
    });
  });

  it("returns zero rows for grouped empty input", () => {
    expect(executeSql(createEmployeesDatabase(), "SELECT department, COUNT(*) FROM employees WHERE id = 99 GROUP BY department")).toMatchObject({
      rows: [],
      rowCount: 0
    });
  });

  it("rejects invalid grouping, duplicates, and wildcard use", () => {
    expectExecutionError(() => executeSql(createEmployeesDatabase(), "SELECT department, COUNT(*) FROM employees"), "INVALID_GROUPING");
    expectExecutionError(() => executeSql(createEmployeesDatabase(), "SELECT name, COUNT(*) FROM employees GROUP BY department"), "INVALID_GROUPING");
    expectExecutionError(() => executeSql(createEmployeesDatabase(), "SELECT department, COUNT(*) FROM employees GROUP BY missing"), "COLUMN_NOT_FOUND");
    expectExecutionError(() => executeSql(createEmployeesDatabase(), "SELECT department FROM employees GROUP BY department, DEPARTMENT"), "DUPLICATE_COLUMN");
    expectExecutionError(() => executeSql(createEmployeesDatabase(), "SELECT * FROM employees GROUP BY department"), "WILDCARD_NOT_ALLOWED");
    expectExecutionError(() => executeSql(createEmployeesDatabase(), "SELECT *, COUNT(*) FROM employees"), "WILDCARD_NOT_ALLOWED");
    expectExecutionError(() => executeSql(createEmployeesDatabase(), "SELECT COUNT(id), COUNT(ID) FROM employees"), "DUPLICATE_COLUMN");
  });

  it("applies ORDER BY and LIMIT to grouped rows", () => {
    const database = createEmployeesDatabase();

    expect(executeSql(database, "SELECT department, COUNT(*) FROM employees GROUP BY department ORDER BY department DESC LIMIT 2")).toMatchObject({
      rows: [
        { department: null, "COUNT(*)": 1 },
        { department: "Engineering", "COUNT(*)": 3 },
      ]
    });
    expect(executeSql(database, "SELECT department, COUNT(*) FROM employees GROUP BY department ORDER BY department ASC LIMIT 0")).toMatchObject({
      rows: [],
      rowCount: 0
    });
  });

  it("supports selected aggregate ordering and rejects unselected aggregate ordering", () => {
    expect(executeSql(createEmployeesDatabase(), "SELECT department, COUNT(*) FROM employees GROUP BY department ORDER BY COUNT(*) DESC")).toMatchObject({
      rows: [
        { department: "Engineering", "COUNT(*)": 3 },
        { department: "Design", "COUNT(*)": 1 },
        { department: null, "COUNT(*)": 1 }
      ]
    });
    expectExecutionError(() => executeSql(createEmployeesDatabase(), "SELECT department, COUNT(id) FROM employees GROUP BY department ORDER BY COUNT(*)"), "INVALID_ORDER_BY");
    expectExecutionError(() => executeSql(createEmployeesDatabase(), "SELECT COUNT(*) FROM employees ORDER BY department"), "INVALID_ORDER_BY");
  });

  it("executes aggregate queries through scripts and snapshots history", () => {
    const database = createEmployeesDatabase();
    const history = new ExecutionHistory();
    const result = new ScriptExecutor(database, history).execute("SELECT department, COUNT(*) FROM employees GROUP BY department;");

    expect(result.statements[0]?.result).toMatchObject({ type: "query", rowCount: 3 });
    const latest = history.latest();
    if (latest?.statements[0]?.result?.type === "query") {
      latest.statements[0].result.rows[0]!.department = "Changed";
    }
    const snapshottedResult = history.latest()?.statements[0]?.result;
    expect(snapshottedResult).toMatchObject({ type: "query" });
    if (snapshottedResult?.type === "query") {
      expect(snapshottedResult.rows[0]?.department).toBe("Engineering");
    }
  });

  it("preserves existing non-aggregate SELECT behavior", () => {
    expect(executeSql(createEmployeesDatabase(), "SELECT name FROM employees ORDER BY id ASC LIMIT 2")).toEqual({
      type: "query",
      columns: ["name"],
      rows: [{ name: "Amira" }, { name: "Maya" }],
      rowCount: 2
    });
  });
});
