import { describe, expect, it } from "vitest";
import { Database, ExecutionHistory, ScriptExecutor, executeSql, type QueryResult } from "../../src/index.js";

function executeQuery(database: Database, sql: string): QueryResult {
  const result = executeSql(database, sql);
  expect(result.type).toBe("query");
  return result as QueryResult;
}

function createDatabase(): Database {
  const database = new Database();
  executeSql(database, "CREATE TABLE departments (id INTEGER, name TEXT, active BOOLEAN)");
  executeSql(database, "CREATE TABLE employees (id INTEGER, name TEXT, department_id INTEGER NULL, salary DECIMAL NULL, bonus DECIMAL NULL, active BOOLEAN)");
  executeSql(database, "INSERT INTO departments VALUES (1, 'Engineering', TRUE)");
  executeSql(database, "INSERT INTO departments VALUES (2, 'Design', TRUE)");
  executeSql(database, "INSERT INTO departments VALUES (3, 'Operations', FALSE)");
  executeSql(database, "INSERT INTO departments VALUES (4, 'Research', TRUE)");
  executeSql(database, "INSERT INTO employees VALUES (1, 'Amira', 1, 48000, 2000, TRUE)");
  executeSql(database, "INSERT INTO employees VALUES (2, 'Maya', 2, 42000.5, 1500, TRUE)");
  executeSql(database, "INSERT INTO employees VALUES (3, 'Noah', 1, 52000, NULL, FALSE)");
  executeSql(database, "INSERT INTO employees VALUES (4, 'Lina', NULL, 45000, 1000, TRUE)");
  executeSql(database, "INSERT INTO employees VALUES (5, 'Sara', 99, NULL, NULL, TRUE)");
  return database;
}

describe("left join and null workflow", () => {
  it("runs the main LEFT JOIN integration query", () => {
    expect(executeQuery(createDatabase(), `
      SELECT
        e.name AS employee,
        d.name AS department,
        e.salary
      FROM employees e
      LEFT JOIN departments d
        ON e.department_id = d.id
      ORDER BY employee ASC;
    `)).toEqual({
      type: "query",
      columns: ["employee", "department", "e.salary"],
      rows: [
        { employee: "Amira", department: "Engineering", "e.salary": 48000 },
        { employee: "Lina", department: null, "e.salary": 45000 },
        { employee: "Maya", department: "Design", "e.salary": 42000.5 },
        { employee: "Noah", department: "Engineering", "e.salary": 52000 },
        { employee: "Sara", department: null, "e.salary": null }
      ],
      rowCount: 5
    });
  });

  it("finds unmatched left rows with IS NULL", () => {
    expect(executeQuery(createDatabase(), `
      SELECT e.name AS employee
      FROM employees e
      LEFT JOIN departments d
        ON e.department_id = d.id
      WHERE d.id IS NULL
      ORDER BY employee ASC;
    `)).toEqual({
      type: "query",
      columns: ["employee"],
      rows: [{ employee: "Lina" }, { employee: "Sara" }],
      rowCount: 2
    });
  });

  it("aggregates over null-extended left join rows", () => {
    expect(executeQuery(createDatabase(), `
      SELECT
        d.name AS department,
        COUNT(e.id) AS employee_count,
        AVG(e.salary) AS average_salary
      FROM departments d
      LEFT JOIN employees e
        ON d.id = e.department_id
      GROUP BY d.name
      ORDER BY employee_count DESC, department ASC;
    `)).toEqual({
      type: "query",
      columns: ["department", "employee_count", "average_salary"],
      rows: [
        { department: "Engineering", employee_count: 2, average_salary: 50000 },
        { department: "Design", employee_count: 1, average_salary: 42000.5 },
        { department: "Operations", employee_count: 0, average_salary: null },
        { department: "Research", employee_count: 0, average_salary: null }
      ],
      rowCount: 4
    });
  });

  it("orders nulls explicitly and runs null-aware mutations", () => {
    const database = createDatabase();

    expect(executeQuery(database, "SELECT name, salary FROM employees ORDER BY salary DESC NULLS LAST, name ASC")).toEqual({
      type: "query",
      columns: ["name", "salary"],
      rows: [
        { name: "Noah", salary: 52000 },
        { name: "Amira", salary: 48000 },
        { name: "Lina", salary: 45000 },
        { name: "Maya", salary: 42000.5 },
        { name: "Sara", salary: null }
      ],
      rowCount: 5
    });

    expect(executeSql(database, "UPDATE employees SET active = FALSE WHERE bonus IS NULL")).toMatchObject({ type: "update", affectedRows: 2 });
    expect(executeSql(database, "DELETE FROM employees WHERE department_id IS NULL")).toMatchObject({ type: "delete", affectedRows: 1 });
    expect(executeQuery(database, "SELECT name, active FROM employees ORDER BY name ASC")).toMatchObject({
      rows: [
        { name: "Amira", active: true },
        { name: "Maya", active: true },
        { name: "Noah", active: false },
        { name: "Sara", active: false }
      ]
    });
  });

  it("snapshots left join results through script history", () => {
    const database = createDatabase();
    const history = new ExecutionHistory();
    const script = new ScriptExecutor(database, history);

    const result = script.execute(`
      SELECT e.name AS employee, d.name AS department
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE d.id IS NULL
      ORDER BY employee ASC;
    `);

    expect(result.statements[0]?.result).toMatchObject({
      type: "query",
      rows: [{ employee: "Lina", department: null }, { employee: "Sara", department: null }]
    });
    const latest = history.latest();
    expect(latest?.statements[0]?.result).toMatchObject({
      type: "query",
      rows: [{ employee: "Lina", department: null }, { employee: "Sara", department: null }]
    });
  });
});
