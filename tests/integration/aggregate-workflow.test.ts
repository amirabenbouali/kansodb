import { describe, expect, it } from "vitest";
import { Database, executeSql, executeSqlScript } from "../../src/index.js";

describe("aggregate workflow integration", () => {
  it("executes the full aggregate integration query", () => {
    const database = new Database();
    executeSqlScript(
      database,
      `
      CREATE TABLE employees (id INTEGER, name TEXT, department TEXT NULL, salary DECIMAL NULL, active BOOLEAN);
      INSERT INTO employees VALUES (1, 'Amira', 'Engineering', 48000, TRUE);
      INSERT INTO employees VALUES (2, 'Maya', 'Design', 42000.5, TRUE);
      INSERT INTO employees VALUES (3, 'Noah', 'Engineering', 52000, FALSE);
      INSERT INTO employees VALUES (4, 'Lina', 'Engineering', NULL, TRUE);
      INSERT INTO employees VALUES (5, 'Sara', NULL, 45000, TRUE);
      `
    );

    expect(
      executeSql(
        database,
        `
        SELECT department, COUNT(*), AVG(salary), MAX(salary)
        FROM employees
        WHERE active = TRUE
        GROUP BY department
        ORDER BY department ASC;
        `
      )
    ).toEqual({
      type: "query",
      columns: ["department", "COUNT(*)", "AVG(salary)", "MAX(salary)"],
      rows: [
        { department: "Design", "COUNT(*)": 1, "AVG(salary)": 42000.5, "MAX(salary)": 42000.5 },
        { department: "Engineering", "COUNT(*)": 2, "AVG(salary)": 48000, "MAX(salary)": 48000 },
        { department: null, "COUNT(*)": 1, "AVG(salary)": 45000, "MAX(salary)": 45000 }
      ],
      rowCount: 3
    });
  });
});
