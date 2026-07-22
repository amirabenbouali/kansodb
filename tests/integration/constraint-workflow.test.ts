import { describe, expect, it } from "vitest";
import { Database, ExecutionError, ExecutionHistory, ScriptExecutor, executeSql, executeSqlScript } from "../../src/index.js";

function expectExecutionError(action: () => unknown, code: string): ExecutionError {
  try {
    action();
    throw new Error("Expected execution action to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(ExecutionError);
    expect(error).toMatchObject({ code });
    return error as ExecutionError;
  }
}

describe("constraint workflow integration", () => {
  function createIntegrationDataset(): Database {
    const database = new Database();
    executeSql(database, "CREATE TABLE departments (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, active BOOLEAN NOT NULL);");
    executeSql(
      database,
      `
      CREATE TABLE employees (
        id INTEGER PRIMARY KEY,
        email TEXT UNIQUE NULL,
        name TEXT NOT NULL,
        department_id INTEGER NULL,
        salary DECIMAL,
        active BOOLEAN NOT NULL,
        FOREIGN KEY (department_id) REFERENCES departments(id)
      );
      `
    );

    executeSql(database, "INSERT INTO departments VALUES (1, 'Engineering', TRUE);");
    executeSql(database, "INSERT INTO departments VALUES (2, 'Design', TRUE);");
    executeSql(database, "INSERT INTO departments VALUES (3, 'Operations', FALSE);");
    executeSql(database, "INSERT INTO employees VALUES (1, 'amira@example.com', 'Amira', 1, 48000, TRUE);");
    executeSql(database, "INSERT INTO employees VALUES (2, 'maya@example.com', 'Maya', 2, 42000.5, TRUE);");
    executeSql(database, "INSERT INTO employees VALUES (3, NULL, 'Noah', 1, 52000, FALSE);");
    executeSql(database, "INSERT INTO employees VALUES (4, NULL, 'Lina', NULL, 45000, TRUE);");
    return database;
  }

  it("enforces primary keys, unique columns, not null columns, and foreign keys through SQL", () => {
    const database = new Database();
    executeSql(database, "CREATE TABLE departments (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);");
    executeSql(
      database,
      `
      CREATE TABLE employees (
        id INTEGER,
        name TEXT NOT NULL,
        department_id INTEGER NULL,
        PRIMARY KEY (id),
        FOREIGN KEY (department_id) REFERENCES departments(id)
      );
      `
    );

    executeSql(database, "INSERT INTO departments VALUES (1, 'Engineering');");
    executeSql(database, "INSERT INTO employees VALUES (1, 'Amira', 1);");
    executeSql(database, "INSERT INTO employees VALUES (2, 'Maya', NULL);");

    expectExecutionError(() => executeSql(database, "INSERT INTO employees VALUES (3, 'Noah', 999);"), "FOREIGN_KEY_VIOLATION");
    expectExecutionError(() => executeSql(database, "INSERT INTO employees VALUES (1, 'Noah', 1);"), "PRIMARY_KEY_VIOLATION");
    expectExecutionError(() => executeSql(database, "INSERT INTO departments VALUES (2, 'Engineering');"), "UNIQUE_CONSTRAINT_VIOLATION");
    expectExecutionError(() => executeSql(database, "INSERT INTO employees VALUES (3, NULL, 1);"), "NOT_NULL_VIOLATION");
    expectExecutionError(() => executeSql(database, "DELETE FROM departments WHERE id = 1;"), "REFERENCED_ROW_EXISTS");

    executeSql(database, "DELETE FROM employees WHERE department_id = 1;");
    executeSql(database, "DELETE FROM departments WHERE id = 1;");

    expect(executeSql(database, "SELECT id, name FROM departments;")).toEqual({
      type: "query",
      columns: ["id", "name"],
      rows: [],
      rowCount: 0
    });
  });

  it("runs the constraint integration join query", () => {
    const database = createIntegrationDataset();

    expect(
      executeSql(
        database,
        `
        SELECT
          e.name AS employee,
          d.name AS department
        FROM employees e
        LEFT JOIN departments d
          ON e.department_id = d.id
        ORDER BY employee ASC;
        `
      )
    ).toEqual({
      type: "query",
      columns: ["employee", "department"],
      rows: [
        { employee: "Amira", department: "Engineering" },
        { employee: "Lina", department: null },
        { employee: "Maya", department: "Design" },
        { employee: "Noah", department: "Engineering" }
      ],
      rowCount: 4
    });
  });

  it("keeps rows unchanged after foreign-key, primary-key, and unique insert failures", () => {
    const database = createIntegrationDataset();
    const beforeEmployees = database.getTable("employees").getRows();

    expectExecutionError(() => executeSql(database, "INSERT INTO employees VALUES (5, 'sara@example.com', 'Sara', 999, 45000, TRUE);"), "FOREIGN_KEY_VIOLATION");
    expectExecutionError(() => executeSql(database, "INSERT INTO employees VALUES (1, 'other@example.com', 'Other', 1, 30000, TRUE);"), "PRIMARY_KEY_VIOLATION");
    expectExecutionError(() => executeSql(database, "INSERT INTO employees VALUES (5, 'amira@example.com', 'Sara', 2, 45000, TRUE);"), "UNIQUE_CONSTRAINT_VIOLATION");

    expect(database.getTable("employees").getRows()).toEqual(beforeEmployees);
  });

  it("blocks referenced deletes and allows parent delete after child removal", () => {
    const database = createIntegrationDataset();
    const beforeDepartments = database.getTable("departments").getRows();
    const beforeEmployees = database.getTable("employees").getRows();

    expectExecutionError(() => executeSql(database, "DELETE FROM departments WHERE id = 1;"), "REFERENCED_ROW_EXISTS");
    expect(database.getTable("departments").getRows()).toEqual(beforeDepartments);
    expect(database.getTable("employees").getRows()).toEqual(beforeEmployees);

    expect(executeSql(database, "DELETE FROM employees WHERE department_id = 1;")).toEqual({
      type: "delete",
      tableName: "employees",
      affectedRows: 2
    });
    expect(executeSql(database, "DELETE FROM departments WHERE id = 1;")).toEqual({
      type: "delete",
      tableName: "departments",
      affectedRows: 1
    });
  });

  it("blocks referenced key updates and preserves atomic unique updates", () => {
    const database = createIntegrationDataset();
    const beforeDepartments = database.getTable("departments").getRows();

    expectExecutionError(() => executeSql(database, "UPDATE departments SET id = 10 WHERE id = 1;"), "REFERENCED_ROW_EXISTS");
    expect(database.getTable("departments").getRows()).toEqual(beforeDepartments);

    executeSql(database, "CREATE TABLE accounts (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL);");
    executeSql(database, "INSERT INTO accounts VALUES (1, 'amira');");
    executeSql(database, "INSERT INTO accounts VALUES (2, 'maya');");
    const beforeAccounts = database.getTable("accounts").getRows();

    expectExecutionError(() => executeSql(database, "UPDATE accounts SET username = 'shared';"), "UNIQUE_CONSTRAINT_VIOLATION");
    expect(database.getTable("accounts").getRows()).toEqual(beforeAccounts);
  });

  it("works inside sequential scripts and reports constraint failures", () => {
    const database = new Database();
    const result = executeSqlScript(
      database,
      `
      CREATE TABLE departments (id INTEGER PRIMARY KEY);
      CREATE TABLE employees (id INTEGER PRIMARY KEY, department_id INTEGER REFERENCES departments(id));
      INSERT INTO departments VALUES (1);
      INSERT INTO employees VALUES (1, 1);
      INSERT INTO employees VALUES (2, 999);
      `,
      { stopOnError: false }
    );

    expect(result.statements).toHaveLength(5);
    expect(result.statements[4]).toMatchObject({
      status: "error",
      error: {
        code: "FOREIGN_KEY_VIOLATION",
        tableName: "employees",
        columnName: "department_id",
        value: 999,
        referencedTableName: "departments",
        referencedColumnName: "id"
      }
    });
    expect(database.getTable("employees").getRows()).toEqual([{ id: 1, department_id: 1 }]);
  });

  it("honors stopOnError for constraint failures in scripts", () => {
    const script = `
      CREATE TABLE departments (id INTEGER PRIMARY KEY);
      CREATE TABLE employees (id INTEGER PRIMARY KEY, department_id INTEGER REFERENCES departments(id));
      INSERT INTO departments VALUES (1);
      INSERT INTO employees VALUES (1, 1);
      INSERT INTO employees VALUES (2, 999);
      SELECT * FROM employees;
    `;

    const stoppedDatabase = new Database();
    const stopped = executeSqlScript(stoppedDatabase, script, { stopOnError: true });
    expect(stopped.statements.map((statement) => statement.status)).toEqual(["success", "success", "success", "success", "error", "skipped"]);
    expect(stoppedDatabase.getTable("employees").getRows()).toEqual([{ id: 1, department_id: 1 }]);

    const continuedDatabase = new Database();
    const continued = executeSqlScript(continuedDatabase, script, { stopOnError: false });
    expect(continued.statements.map((statement) => statement.status)).toEqual(["success", "success", "success", "success", "error", "success"]);
    expect(continued.statements[5]?.result).toMatchObject({
      type: "query",
      rows: [{ id: 1, department_id: 1 }],
      rowCount: 1
    });
  });

  it("snapshots constraint error metadata in execution history", () => {
    const history = new ExecutionHistory();
    const executor = new ScriptExecutor(new Database(), history);

    executor.execute(
      `
      CREATE TABLE departments (id INTEGER PRIMARY KEY);
      CREATE TABLE employees (id INTEGER PRIMARY KEY, department_id INTEGER REFERENCES departments(id));
      INSERT INTO employees VALUES (1, 999);
      `,
      { stopOnError: false }
    );

    const listed = history.list();
    listed[0]!.statements[2]!.error!.tableName = "mutated";

    expect(history.latest()?.statements[2]?.error).toMatchObject({
      code: "FOREIGN_KEY_VIOLATION",
      tableName: "employees",
      columnName: "department_id",
      value: 999,
      referencedTableName: "departments",
      referencedColumnName: "id"
    });
  });
});
