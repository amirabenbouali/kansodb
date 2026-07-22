import { describe, expect, it } from "vitest";
import {
  Database,
  ExecutionHistory,
  ScriptExecutor,
  executeSqlScript,
  type ScriptExecutionResult
} from "../../src/index.js";

function createEmployeesDatabase(): Database {
  const database = new Database();
  executeSqlScript(database, "CREATE TABLE employees (id INTEGER, name TEXT, department TEXT, salary DECIMAL NULL, active BOOLEAN)");
  return database;
}

function seedEmployees(database = createEmployeesDatabase()): Database {
  executeSqlScript(database, "INSERT INTO employees VALUES (1, 'Amira', 'Engineering', 48000, TRUE)");
  executeSqlScript(database, "INSERT INTO employees VALUES (2, 'Maya', 'Design', 42000.5, TRUE)");
  return database;
}

function expectIso(value: string): void {
  expect(Number.isNaN(Date.parse(value))).toBe(false);
}

describe("ScriptExecutor success", () => {
  it("executes an empty script", () => {
    expect(executeSqlScript(new Database(), "")).toMatchObject({
      type: "script",
      statements: [],
      statementCount: 0,
      succeeded: 0,
      failed: 0,
      completed: true
    });
  });

  it("executes one statement and multiple successful statements", () => {
    expect(executeSqlScript(new Database(), "CREATE TABLE t (id INTEGER)").succeeded).toBe(1);
    expect(executeSqlScript(new Database(), "CREATE TABLE t (id INTEGER); INSERT INTO t VALUES (1); SELECT * FROM t").succeeded).toBe(3);
  });

  it("executes create, insert, select, update, and delete workflows", () => {
    const database = seedEmployees();

    expect(executeSqlScript(database, "SELECT name FROM employees").statements.at(-1)?.result).toMatchObject({ type: "query", rowCount: 2 });
    expect(executeSqlScript(database, "UPDATE employees SET salary = 50000 WHERE id = 1; SELECT salary FROM employees WHERE id = 1").statements.at(-1)?.result).toMatchObject({
      rows: [{ salary: 50000 }]
    });
    expect(executeSqlScript(database, "DELETE FROM employees WHERE id = 2; SELECT name FROM employees").statements.at(-1)?.result).toMatchObject({
      rows: [{ name: "Amira" }]
    });
  });

  it("reports order, counts, completed flag, durations, and ISO timestamps", () => {
    const result = executeSqlScript(new Database(), "CREATE TABLE t (id INTEGER); INSERT INTO t VALUES (1); SELECT * FROM t");

    expect(result.statements.map((record) => record.index)).toEqual([0, 1, 2]);
    expect(result.statementCount).toBe(3);
    expect(result.succeeded).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.completed).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    for (const record of result.statements) {
      expect(record.durationMs).toBeGreaterThanOrEqual(0);
      expectIso(record.startedAt);
      expectIso(record.finishedAt);
      expect(record.sql).toBeTruthy();
    }
  });
});

describe("ScriptExecutor stopOnError", () => {
  const script = `
    INSERT INTO employees VALUES (3, 'Noah', 'Engineering', 52000, TRUE);
    INSERT INTO missing_table VALUES (4, 'Lina', 'Engineering', 47000, TRUE);
    INSERT INTO employees VALUES (5, 'Sara', 'Design', 45000, TRUE);
  `;

  it("stops after an execution error by default", () => {
    const database = seedEmployees();
    const result = executeSqlScript(database, script);

    expect(result.statements.map((record) => record.status)).toEqual(["success", "error", "skipped"]);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.completed).toBe(false);
    expect(result.statements[1]?.error).toMatchObject({ code: "TABLE_NOT_FOUND" });
    expect(database.getTable("employees").getRows().map((row) => row.name)).toEqual(["Amira", "Maya", "Noah"]);
  });

  it("continues after execution errors when configured", () => {
    const database = seedEmployees();
    const result = executeSqlScript(database, script, { stopOnError: false });

    expect(result.statements.map((record) => record.status)).toEqual(["success", "error", "success"]);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.completed).toBe(true);
    expect(database.getTable("employees").getRows().map((row) => row.name)).toEqual(["Amira", "Maya", "Noah", "Sara"]);
  });
});

describe("ScriptExecutor parse and lex failures", () => {
  it("executes nothing on lexer failure", () => {
    const database = seedEmployees();
    const before = database.getTable("employees").getRows();
    const result = executeSqlScript(database, "INSERT INTO employees VALUES (3, @);");

    expect(result).toMatchObject({ failed: 1, completed: false });
    expect(result.statements[0]?.error).toMatchObject({ code: "LEX_ERROR", position: { start: 33, end: 33 } });
    expect(database.getTable("employees").getRows()).toEqual(before);
  });

  it("executes nothing on parser failure, including later-statement failures", () => {
    const database = seedEmployees();
    const before = database.getTable("employees").getRows();
    const result = executeSqlScript(database, "INSERT INTO employees VALUES (3, 'Noah', 'Engineering', 52000, TRUE); DELETE FROM;");

    expect(result.statements[0]?.error).toMatchObject({ code: "PARSE_ERROR" });
    expect(database.getTable("employees").getRows()).toEqual(before);
  });
});

describe("ExecutionHistory", () => {
  it("adds, lists, retrieves latest, and clears results", () => {
    const history = new ExecutionHistory();
    const first = executeSqlScript(new Database(), "", undefined);
    const second = executeSqlScript(new Database(), "CREATE TABLE t (id INTEGER)", undefined);

    history.add(first);
    history.add(second);
    expect(history.list().map((result) => result.statementCount)).toEqual([0, 1]);
    expect(history.latest()?.statementCount).toBe(1);
    history.clear();
    expect(history.list()).toEqual([]);
    expect(history.latest()).toBeUndefined();
  });

  it("snapshots returned lists, nested records, query rows, and failed scripts", () => {
    const history = new ExecutionHistory();
    const database = seedEmployees();
    const executor = new ScriptExecutor(database, history);
    const result = executor.execute("SELECT name FROM employees; INSERT INTO missing_table VALUES (1)", { stopOnError: false });

    const listed = history.list();
    listed.push({ ...result, statements: [] });
    listed[0]!.statements[0]!.status = "skipped";
    const queryResult = listed[0]!.statements[0]!.result;
    if (queryResult?.type === "query") {
      queryResult.rows[0]!.name = "Changed";
    }

    const fresh = history.list()[0] as ScriptExecutionResult;
    expect(fresh.statements.map((record) => record.status)).toEqual(["success", "error"]);
    expect(fresh.statements[0]?.result).toMatchObject({ type: "query", rows: [{ name: "Amira" }, { name: "Maya" }] });
    expect(fresh.statements[1]?.error).toMatchObject({ code: "TABLE_NOT_FOUND" });
  });
});
