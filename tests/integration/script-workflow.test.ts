import { describe, expect, it } from "vitest";
import { Database, ExecutionHistory, ScriptExecutor } from "../../src/index.js";

describe("script workflow integration", () => {
  it("runs the successful integration script and records history", () => {
    const database = new Database();
    const history = new ExecutionHistory();
    const executor = new ScriptExecutor(database, history);
    const script = `
      CREATE TABLE employees (
        id INTEGER,
        name TEXT,
        department TEXT,
        salary DECIMAL NULL,
        active BOOLEAN
      );

      INSERT INTO employees
      VALUES (1, 'Amira', 'Engineering', 48000, TRUE);

      INSERT INTO employees
      VALUES (2, 'Maya', 'Design', 42000.5, TRUE);

      UPDATE employees
      SET salary = 50000
      WHERE id = 1;

      SELECT name, salary
      FROM employees
      ORDER BY salary DESC;
    `;

    const result = executor.execute(script);

    expect(result).toMatchObject({
      type: "script",
      statementCount: 5,
      succeeded: 5,
      failed: 0,
      completed: true
    });
    expect(result.statements.at(-1)?.result).toEqual({
      type: "query",
      columns: ["name", "salary"],
      rows: [
        { name: "Amira", salary: 50000 },
        { name: "Maya", salary: 42000.5 }
      ],
      rowCount: 2
    });
    expect(history.latest()).toMatchObject({ statementCount: 5, succeeded: 5 });
  });

  it("handles error continuation modes", () => {
    const script = `
      INSERT INTO employees VALUES (3, 'Noah', 'Engineering', 52000, TRUE);
      INSERT INTO missing_table VALUES (4, 'Lina', 'Engineering', 47000, TRUE);
      INSERT INTO employees VALUES (5, 'Sara', 'Design', 45000, TRUE);
    `;

    const stopped = createSeededExecutor();
    const stoppedResult = stopped.executor.execute(script, { stopOnError: true });
    expect(stoppedResult.statements.map((record) => record.status)).toEqual(["success", "error", "skipped"]);
    expect(stopped.database.getTable("employees").getRows().map((row) => row.name)).toEqual(["Amira", "Maya", "Noah"]);

    const continued = createSeededExecutor();
    const continuedResult = continued.executor.execute(script, { stopOnError: false });
    expect(continuedResult.statements.map((record) => record.status)).toEqual(["success", "error", "success"]);
    expect(continued.database.getTable("employees").getRows().map((row) => row.name)).toEqual(["Amira", "Maya", "Noah", "Sara"]);
  });
});

function createSeededExecutor(): { database: Database; executor: ScriptExecutor } {
  const database = new Database();
  const executor = new ScriptExecutor(database);
  executor.execute("CREATE TABLE employees (id INTEGER, name TEXT, department TEXT, salary DECIMAL NULL, active BOOLEAN)");
  executor.execute("INSERT INTO employees VALUES (1, 'Amira', 'Engineering', 48000, TRUE)");
  executor.execute("INSERT INTO employees VALUES (2, 'Maya', 'Design', 42000.5, TRUE)");
  return { database, executor };
}
