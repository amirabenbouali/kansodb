import { describe, expect, it } from "vitest";
import { Database, DataType, ExecutionError, executeSql, type QueryResult } from "../../src/index.js";

function createCompanyDatabase(): Database {
  const database = new Database();

  database.createTable("employees", [
    { name: "id", type: DataType.INTEGER },
    { name: "name", type: DataType.TEXT },
    { name: "department_id", type: DataType.INTEGER },
    { name: "salary", type: DataType.DECIMAL },
    { name: "active", type: DataType.BOOLEAN }
  ]);

  database.createTable("departments", [
    { name: "id", type: DataType.INTEGER },
    { name: "name", type: DataType.TEXT },
    { name: "budget", type: DataType.INTEGER }
  ]);

  database.getTable("employees").insert({ id: 1, name: "Amira", department_id: 10, salary: 48000, active: true });
  database.getTable("employees").insert({ id: 2, name: "Maya", department_id: 20, salary: 42000.5, active: true });
  database.getTable("employees").insert({ id: 3, name: "Noah", department_id: 10, salary: 52000, active: false });
  database.getTable("employees").insert({ id: 4, name: "Lina", department_id: 30, salary: 45000, active: true });

  database.getTable("departments").insert({ id: 10, name: "Engineering", budget: 200000 });
  database.getTable("departments").insert({ id: 20, name: "Design", budget: 90000 });
  database.getTable("departments").insert({ id: 40, name: "Finance", budget: 120000 });

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

describe("join execution", () => {
  it("executes INNER JOIN with qualified selected columns", () => {
    expect(
      executeQuery(
        createCompanyDatabase(),
        "SELECT e.name, d.name FROM employees e INNER JOIN departments d ON e.department_id = d.id ORDER BY e.id ASC"
      )
    ).toEqual({
      type: "query",
      columns: ["e.name", "d.name"],
      rows: [
        { "e.name": "Amira", "d.name": "Engineering" },
        { "e.name": "Maya", "d.name": "Design" },
        { "e.name": "Noah", "d.name": "Engineering" }
      ],
      rowCount: 3
    });
  });

  it("treats bare JOIN as an inner join", () => {
    expect(
      executeQuery(
        createCompanyDatabase(),
        "SELECT employees.name, departments.name FROM employees JOIN departments ON employees.department_id = departments.id ORDER BY employees.id"
      ).rows
    ).toEqual([
      { "employees.name": "Amira", "departments.name": "Engineering" },
      { "employees.name": "Maya", "departments.name": "Design" },
      { "employees.name": "Noah", "departments.name": "Engineering" }
    ]);
  });

  it("returns qualified labels for SELECT * over joins", () => {
    const result = executeQuery(createCompanyDatabase(), "SELECT * FROM employees e JOIN departments d ON e.department_id = d.id LIMIT 1");

    expect(result.columns).toEqual(["e.id", "e.name", "e.department_id", "e.salary", "e.active", "d.id", "d.name", "d.budget"]);
    expect(result.rows[0]).toEqual({
      "e.id": 1,
      "e.name": "Amira",
      "e.department_id": 10,
      "e.salary": 48000,
      "e.active": true,
      "d.id": 10,
      "d.name": "Engineering",
      "d.budget": 200000
    });
  });

  it("keeps non-join SELECT * output unqualified even with an alias", () => {
    expect(executeQuery(createCompanyDatabase(), "SELECT * FROM employees e LIMIT 1")).toMatchObject({
      columns: ["id", "name", "department_id", "salary", "active"],
      rows: [{ id: 1, name: "Amira", department_id: 10, salary: 48000, active: true }]
    });
  });

  it("filters and orders joined rows with qualified column references", () => {
    expect(
      executeQuery(
        createCompanyDatabase(),
        "SELECT e.name FROM employees e JOIN departments d ON e.department_id = d.id WHERE d.name = 'Engineering' ORDER BY e.salary DESC LIMIT 1"
      )
    ).toMatchObject({
      rows: [{ "e.name": "Noah" }],
      rowCount: 1
    });
  });

  it("allows unqualified columns when they resolve to one visible relation", () => {
    expect(
      executeQuery(
        createCompanyDatabase(),
        "SELECT salary, budget FROM employees e JOIN departments d ON department_id = d.id WHERE budget > 100000 ORDER BY salary ASC"
      ).rows
    ).toEqual([
      { salary: 48000, budget: 200000 },
      { salary: 52000, budget: 200000 }
    ]);
  });

  it("rejects ambiguous unqualified columns", () => {
    expectExecutionError(
      () => executeSql(createCompanyDatabase(), "SELECT name FROM employees e JOIN departments d ON e.department_id = d.id"),
      "AMBIGUOUS_COLUMN"
    );
  });

  it("rejects the original table name when an alias is present", () => {
    expectExecutionError(
      () => executeSql(createCompanyDatabase(), "SELECT employees.name FROM employees e JOIN departments d ON e.department_id = d.id"),
      "RELATION_NOT_FOUND"
    );
  });

  it("rejects duplicate visible relation names", () => {
    expectExecutionError(
      () => executeSql(createCompanyDatabase(), "SELECT * FROM employees e JOIN departments e ON e.department_id = e.id"),
      "DUPLICATE_RELATION"
    );
  });

  it("executes grouped aggregates over joined rows", () => {
    expect(
      executeQuery(
        createCompanyDatabase(),
        "SELECT d.name, COUNT(e.id), SUM(e.salary) FROM employees e JOIN departments d ON e.department_id = d.id GROUP BY d.name ORDER BY d.name ASC"
      )
    ).toEqual({
      type: "query",
      columns: ["d.name", "COUNT(e.id)", "SUM(e.salary)"],
      rows: [
        { "d.name": "Design", "COUNT(e.id)": 1, "SUM(e.salary)": 42000.5 },
        { "d.name": "Engineering", "COUNT(e.id)": 2, "SUM(e.salary)": 100000 }
      ],
      rowCount: 2
    });
  });

  it("preserves unmatched left rows with null-extended right columns", () => {
    expect(
      executeQuery(
        createCompanyDatabase(),
        "SELECT e.name, d.name FROM employees e LEFT JOIN departments d ON e.department_id = d.id ORDER BY e.id ASC"
      )
    ).toEqual({
      type: "query",
      columns: ["e.name", "d.name"],
      rows: [
        { "e.name": "Amira", "d.name": "Engineering" },
        { "e.name": "Maya", "d.name": "Design" },
        { "e.name": "Noah", "d.name": "Engineering" },
        { "e.name": "Lina", "d.name": null }
      ],
      rowCount: 4
    });
  });

  it("filters unmatched left join rows with IS NULL", () => {
    expect(
      executeQuery(
        createCompanyDatabase(),
        "SELECT e.name FROM employees e LEFT JOIN departments d ON e.department_id = d.id WHERE d.id IS NULL"
      )
    ).toMatchObject({
      rows: [{ "e.name": "Lina" }],
      rowCount: 1
    });
  });

  it("does not match null join keys to null join keys", () => {
    expect(
      executeQuery(createCompanyDatabase(), "SELECT e.name, d.name FROM employees e LEFT JOIN departments d ON e.department_id = d.id WHERE e.name = 'Lina'")
    ).toMatchObject({
      rows: [{ "e.name": "Lina", "d.name": null }]
    });
  });

  it("projects wildcard nulls for unmatched right rows", () => {
    const result = executeQuery(
      createCompanyDatabase(),
      "SELECT * FROM employees e LEFT JOIN departments d ON e.department_id = d.id WHERE e.name = 'Lina'"
    );

    expect(result.rows[0]).toMatchObject({
      "e.name": "Lina",
      "d.id": null,
      "d.name": null,
      "d.budget": null
    });
  });

  it("aggregates over null-extended left join rows", () => {
    expect(
      executeQuery(
        createCompanyDatabase(),
        "SELECT d.name, COUNT(e.id), COUNT(*), SUM(e.salary) FROM departments d LEFT JOIN employees e ON d.id = e.department_id GROUP BY d.name ORDER BY d.name ASC NULLS LAST"
      )
    ).toMatchObject({
      rows: [
        { "d.name": "Design", "COUNT(e.id)": 1, "COUNT(*)": 1, "SUM(e.salary)": 42000.5 },
        { "d.name": "Engineering", "COUNT(e.id)": 2, "COUNT(*)": 2, "SUM(e.salary)": 100000 },
        { "d.name": "Finance", "COUNT(e.id)": 0, "COUNT(*)": 1, "SUM(e.salary)": null }
      ]
    });
  });

  it("supports explicit null ordering", () => {
    const database = new Database();
    executeSql(database, "CREATE TABLE employees (name TEXT, salary DECIMAL NULL)");
    executeSql(database, "INSERT INTO employees VALUES ('Amira', 48000)");
    executeSql(database, "INSERT INTO employees VALUES ('Maya', 42000.5)");
    executeSql(database, "INSERT INTO employees VALUES ('Noah', 52000)");
    executeSql(database, "INSERT INTO employees VALUES ('Lina', NULL)");

    expect(executeQuery(database, "SELECT name, salary FROM employees ORDER BY salary DESC NULLS LAST").rows.map((row) => row.name)).toEqual([
      "Noah",
      "Amira",
      "Maya",
      "Lina"
    ]);
    expect(executeQuery(database, "SELECT name, salary FROM employees ORDER BY salary ASC NULLS FIRST").rows.map((row) => row.name)).toEqual([
      "Lina",
      "Maya",
      "Amira",
      "Noah"
    ]);
  });
});
