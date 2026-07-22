import { describe, expect, it } from "vitest";
import { Database, ExecutionError, executeSql, type QueryResult } from "../../src/index.js";

function createDatabase(): Database {
  const database = new Database();

  executeSql(database, "CREATE TABLE departments (id INTEGER, name TEXT, active BOOLEAN)");
  executeSql(database, "CREATE TABLE employees (id INTEGER, name TEXT, department_id INTEGER NULL, salary DECIMAL NULL, bonus DECIMAL NULL, active BOOLEAN)");
  executeSql(database, "INSERT INTO departments VALUES (1, 'Engineering', TRUE)");
  executeSql(database, "INSERT INTO departments VALUES (2, 'Design', TRUE)");
  executeSql(database, "INSERT INTO departments VALUES (3, 'Operations', FALSE)");
  executeSql(database, "INSERT INTO employees VALUES (1, 'Amira', 1, 48000, 2000, TRUE)");
  executeSql(database, "INSERT INTO employees VALUES (2, 'Maya', 2, 42000.5, 1500, TRUE)");
  executeSql(database, "INSERT INTO employees VALUES (3, 'Noah', 1, 52000, NULL, FALSE)");
  executeSql(database, "INSERT INTO employees VALUES (4, 'Lina', NULL, 45000, 1000, TRUE)");

  return database;
}

function executeQuery(database: Database, sql: string): QueryResult {
  const result = executeSql(database, sql);
  expect(result.type).toBe("query");
  return result as QueryResult;
}

describe("computed expression workflow", () => {
  it("runs computed projection with aliases, qualified columns, and multi-key ordering", () => {
    const result = executeQuery(createDatabase(), `
      SELECT
        e.name AS employee,
        e.salary,
        e.bonus,
        e.salary + e.bonus AS total_compensation,
        e.salary * 1.1 AS adjusted_salary
      FROM employees e
      WHERE e.active = TRUE
      ORDER BY adjusted_salary DESC, employee ASC;
    `);

    expect(result).toMatchObject({
      type: "query",
      columns: ["employee", "e.salary", "e.bonus", "total_compensation", "adjusted_salary"],
      rows: [
        { employee: "Amira", "e.salary": 48000, "e.bonus": 2000, total_compensation: 50000 },
        { employee: "Lina", "e.salary": 45000, "e.bonus": 1000, total_compensation: 46000 },
        { employee: "Maya", "e.salary": 42000.5, "e.bonus": 1500, total_compensation: 43500.5 }
      ],
      rowCount: 3
    });
    expect(Number(result.rows[0]?.adjusted_salary)).toBeCloseTo(52800);
    expect(Number(result.rows[1]?.adjusted_salary)).toBeCloseTo(49500);
    expect(Number(result.rows[2]?.adjusted_salary)).toBeCloseTo(46200.55);
  });

  it("runs aggregate aliases through joined GROUP BY ordering", () => {
    expect(executeSql(createDatabase(), `
      SELECT
        d.name AS department,
        COUNT(e.id) AS employee_count,
        AVG(e.salary) AS average_salary
      FROM employees e
      JOIN departments d
        ON e.department_id = d.id
      GROUP BY d.name
      ORDER BY employee_count DESC, department ASC;
    `)).toEqual({
      type: "query",
      columns: ["department", "employee_count", "average_salary"],
      rows: [
        { department: "Engineering", employee_count: 2, average_salary: 50000 },
        { department: "Design", employee_count: 1, average_salary: 42000.5 }
      ],
      rowCount: 2
    });
  });

  it("runs arithmetic updates and preserves atomicity on arithmetic failure", () => {
    const database = createDatabase();

    expect(executeSql(database, `
      UPDATE employees
      SET
        salary = salary * 1.05,
        bonus = bonus + 500
      WHERE department_id = 1;
    `)).toMatchObject({ type: "update", affectedRows: 2 });

    expect(executeSql(database, "SELECT name, salary, bonus FROM employees WHERE department_id = 1 ORDER BY name ASC")).toMatchObject({
      rows: [
        { name: "Amira", salary: 50400, bonus: 2500 },
        { name: "Noah", salary: 54600, bonus: null }
      ]
    });

    const before = executeSql(database, "SELECT * FROM employees ORDER BY id ASC");

    try {
      executeSql(database, "UPDATE employees SET salary = salary / 0 WHERE department_id = 1");
      throw new Error("Expected UPDATE to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ExecutionError);
      expect(error).toMatchObject({ code: "DIVISION_BY_ZERO" });
    }

    expect(executeSql(database, "SELECT * FROM employees ORDER BY id ASC")).toEqual(before);
  });
});
