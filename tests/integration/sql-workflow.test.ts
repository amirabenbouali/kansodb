import { describe, expect, it } from "vitest";
import { Database, executeSql } from "../../src/index.js";

describe("SQL workflow integration", () => {
  it("executes CREATE TABLE, INSERT, and SELECT as separate calls", () => {
    const database = new Database();

    const createResult = executeSql(
      database,
      `
      CREATE TABLE employees (
        id INTEGER,
        name TEXT,
        department TEXT,
        salary DECIMAL NULL,
        active BOOLEAN
      );
      `
    );

    const firstInsertResult = executeSql(
      database,
      `
      INSERT INTO employees
      VALUES (1, 'Amira', 'Engineering', 48000, TRUE);
      `
    );

    const secondInsertResult = executeSql(
      database,
      `
      INSERT INTO employees
        (id, name, department, salary, active)
      VALUES
        (2, 'Maya', 'Design', 42000.5, TRUE);
      `
    );

    const thirdInsertResult = executeSql(
      database,
      `
      INSERT INTO employees
        (name, id, department, active)
      VALUES
        ('Lina', 3, 'Engineering', TRUE);
      `
    );

    const result = executeSql(
      database,
      `
      SELECT name, salary
      FROM employees
      WHERE active = TRUE
      ORDER BY salary DESC;
      `
    );

    expect(createResult).toEqual({ type: "create_table", tableName: "employees", columnCount: 5 });
    expect(firstInsertResult).toEqual({ type: "insert", tableName: "employees", affectedRows: 1 });
    expect(secondInsertResult).toEqual({ type: "insert", tableName: "employees", affectedRows: 1 });
    expect(thirdInsertResult).toEqual({ type: "insert", tableName: "employees", affectedRows: 1 });
    expect(result).toEqual({
      type: "query",
      columns: ["name", "salary"],
      rows: [
        { name: "Amira", salary: 48000 },
        { name: "Maya", salary: 42000.5 },
        { name: "Lina", salary: null }
      ],
      rowCount: 3
    });
    expect(database.getTable("employees").getRows()).toEqual([
      { id: 1, name: "Amira", department: "Engineering", salary: 48000, active: true },
      { id: 2, name: "Maya", department: "Design", salary: 42000.5, active: true },
      { id: 3, name: "Lina", department: "Engineering", salary: null, active: true }
    ]);
  });

  it("rejects multi-statement SQL strings", () => {
    const database = new Database();

    expect(() => executeSql(database, "CREATE TABLE users (id INTEGER); INSERT INTO users VALUES (1);")).toThrow();
  });
});
