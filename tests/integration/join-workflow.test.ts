import { describe, expect, it } from "vitest";
import { Database, executeSql } from "../../src/index.js";

describe("join workflow", () => {
  it("runs a joined SELECT from SQL text through lexer, parser, and execution", () => {
    const database = new Database();

    executeSql(database, "CREATE TABLE employees (id INTEGER, name TEXT, department_id INTEGER, salary DECIMAL)");
    executeSql(database, "CREATE TABLE departments (id INTEGER, name TEXT)");
    executeSql(database, "INSERT INTO employees VALUES (1, 'Amira', 10, 48000)");
    executeSql(database, "INSERT INTO employees VALUES (2, 'Maya', 20, 42000.5)");
    executeSql(database, "INSERT INTO employees VALUES (3, 'Noah', 10, 52000)");
    executeSql(database, "INSERT INTO departments VALUES (10, 'Engineering')");
    executeSql(database, "INSERT INTO departments VALUES (20, 'Design')");

    const result = executeSql(database, `
      SELECT e.name, d.name, e.salary
      FROM employees AS e
      INNER JOIN departments AS d ON e.department_id = d.id
      WHERE d.name = 'Engineering'
      ORDER BY e.salary DESC
      LIMIT 2;
    `);

    expect(result).toEqual({
      type: "query",
      columns: ["e.name", "d.name", "e.salary"],
      rows: [
        { "e.name": "Noah", "d.name": "Engineering", "e.salary": 52000 },
        { "e.name": "Amira", "d.name": "Engineering", "e.salary": 48000 }
      ],
      rowCount: 2
    });
  });
});
