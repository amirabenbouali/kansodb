import { describe, expect, it } from "vitest";
import {
  Database,
  DataType,
  ExecutionError,
  Executor,
  executeSql,
  parseSelectStatement,
  tokenize,
  type InputRow,
  type SelectStatement
} from "../../src/index.js";

function createEmployeesDatabase(rows: InputRow[] = employeeRows()): Database {
  const database = new Database();
  database.createTable("employees", [
    { name: "id", type: DataType.INTEGER },
    { name: "name", type: DataType.TEXT },
    { name: "department", type: DataType.TEXT },
    { name: "salary", type: DataType.DECIMAL, nullable: true },
    { name: "active", type: DataType.BOOLEAN }
  ]);

  const table = database.getTable("employees");
  for (const row of rows) {
    table.insert(row);
  }

  return database;
}

function employeeRows(): InputRow[] {
  return [
    { id: 1, name: "Amira", department: "Engineering", salary: 48000, active: true },
    { id: 2, name: "Maya", department: "Design", salary: 42000.5, active: true },
    { id: 3, name: "Noah", department: "Engineering", salary: 52000, active: false },
    { id: 4, name: "Lina", department: "Engineering", salary: null, active: true }
  ];
}

function execute(sql: string, database = createEmployeesDatabase()) {
  return new Executor(database).execute(parseSelectStatement(tokenize(sql)));
}

function names(sql: string, database?: Database): string[] {
  return execute(sql, database).rows.map((row) => String(row.name));
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

describe("Executor basic SELECT", () => {
  it("executes SELECT *", () => {
    expect(execute("SELECT * FROM employees").rows[0]).toEqual({
      id: 1,
      name: "Amira",
      department: "Engineering",
      salary: 48000,
      active: true
    });
  });

  it("selects one column", () => {
    expect(execute("SELECT name FROM employees").rows[0]).toEqual({ name: "Amira" });
  });

  it("selects multiple columns", () => {
    expect(execute("SELECT name, salary FROM employees").rows[0]).toEqual({ name: "Amira", salary: 48000 });
  });

  it("preserves selected column order", () => {
    expect(execute("SELECT salary, name FROM employees").columns).toEqual(["salary", "name"]);
  });

  it("preserves schema order for SELECT *", () => {
    expect(execute("SELECT * FROM employees").columns).toEqual(["id", "name", "department", "salary", "active"]);
  });

  it("returns selected columns for an empty table result", () => {
    expect(execute("SELECT name, salary FROM employees WHERE department = 'Missing'")).toEqual({
      type: "query",
      columns: ["name", "salary"],
      rows: [],
      rowCount: 0
    });
  });

  it("returns the correct row count", () => {
    expect(execute("SELECT name FROM employees WHERE department = 'Engineering'").rowCount).toBe(3);
  });

  it("returns rows as copies", () => {
    const database = createEmployeesDatabase();
    const result = execute("SELECT name FROM employees", database);
    result.rows[0]!.name = "Changed";

    expect(execute("SELECT name FROM employees LIMIT 1", database).rows[0]).toEqual({ name: "Amira" });
  });
});

describe("Executor table and column resolution", () => {
  it("looks up tables case-insensitively", () => {
    expect(execute("SELECT name FROM EMPLOYEES").rowCount).toBe(4);
  });

  it("looks up selected columns case-insensitively", () => {
    expect(execute("SELECT NAME FROM employees").rows[0]).toEqual({ name: "Amira" });
  });

  it("uses original column spelling in results", () => {
    const database = new Database();
    database.createTable("employees", [{ name: "EmployeeName", type: DataType.TEXT }]);
    database.getTable("employees").insert({ employeename: "Amira" });

    expect(execute("SELECT employeename FROM employees", database)).toEqual({
      type: "query",
      columns: ["EmployeeName"],
      rows: [{ EmployeeName: "Amira" }],
      rowCount: 1
    });
  });

  it("rejects unknown tables", () => {
    expectExecutionError(() => execute("SELECT name FROM missing"), "TABLE_NOT_FOUND");
  });

  it("rejects unknown selected columns", () => {
    expectExecutionError(() => execute("SELECT missing FROM employees"), "COLUMN_NOT_FOUND");
  });

  it("rejects duplicate selected columns", () => {
    expectExecutionError(() => execute("SELECT name, name FROM employees"), "DUPLICATE_COLUMN");
  });

  it("rejects case-insensitive duplicate selected columns", () => {
    expectExecutionError(() => execute("SELECT name, NAME FROM employees"), "DUPLICATE_COLUMN");
  });

  it("rejects unknown WHERE columns", () => {
    expectExecutionError(() => execute("SELECT name FROM employees WHERE missing = 1"), "COLUMN_NOT_FOUND");
  });

  it("rejects unknown ORDER BY columns", () => {
    expectExecutionError(() => execute("SELECT name FROM employees ORDER BY missing"), "COLUMN_NOT_FOUND");
  });
});

describe("Executor WHERE expressions", () => {
  it("filters numeric equality", () => {
    expect(names("SELECT name FROM employees WHERE salary = 48000")).toEqual(["Amira"]);
  });

  it("filters numeric inequality", () => {
    expect(names("SELECT name FROM employees WHERE id != 1")).toEqual(["Maya", "Noah", "Lina"]);
  });

  it("filters greater than", () => {
    expect(names("SELECT name FROM employees WHERE salary > 48000")).toEqual(["Noah"]);
  });

  it("filters greater than or equal", () => {
    expect(names("SELECT name FROM employees WHERE salary >= 48000")).toEqual(["Amira", "Noah"]);
  });

  it("filters less than", () => {
    expect(names("SELECT name FROM employees WHERE salary < 48000")).toEqual(["Maya"]);
  });

  it("filters less than or equal", () => {
    expect(names("SELECT name FROM employees WHERE salary <= 48000")).toEqual(["Amira", "Maya"]);
  });

  it("filters string equality", () => {
    expect(names("SELECT name FROM employees WHERE department = 'Design'")).toEqual(["Maya"]);
  });

  it("filters string inequality", () => {
    expect(names("SELECT name FROM employees WHERE department != 'Design'")).toEqual(["Amira", "Noah", "Lina"]);
  });

  it("filters string lexicographical comparison", () => {
    expect(names("SELECT name FROM employees WHERE name > 'Maya'")).toEqual(["Noah"]);
  });

  it("filters boolean equality", () => {
    expect(names("SELECT name FROM employees WHERE active = FALSE")).toEqual(["Noah"]);
  });

  it("filters null equality", () => {
    expect(names("SELECT name FROM employees WHERE salary = NULL")).toEqual(["Lina"]);
  });

  it("filters null inequality", () => {
    expect(names("SELECT name FROM employees WHERE salary != NULL")).toEqual(["Amira", "Maya", "Noah"]);
  });

  it("does not use implicit numeric coercion", () => {
    expect(names("SELECT name FROM employees WHERE salary = '48000'")).toEqual([]);
  });

  it("rejects different-type ordering comparisons", () => {
    expectExecutionError(() => execute("SELECT name FROM employees WHERE salary > '45000'"), "TYPE_MISMATCH");
  });

  it("rejects boolean ordering comparisons", () => {
    expectExecutionError(() => execute("SELECT name FROM employees WHERE active > FALSE"), "INVALID_COMPARISON");
  });

  it("rejects null ordering comparisons", () => {
    expectExecutionError(() => execute("SELECT name FROM employees WHERE salary > NULL"), "INVALID_COMPARISON");
  });
});

describe("Executor logical expressions", () => {
  it("executes AND", () => {
    expect(names("SELECT name FROM employees WHERE department = 'Engineering' AND active = TRUE")).toEqual(["Amira", "Lina"]);
  });

  it("executes OR", () => {
    expect(names("SELECT name FROM employees WHERE department = 'Design' OR active = FALSE")).toEqual(["Maya", "Noah"]);
  });

  it("reflects parser precedence during execution", () => {
    expect(names("SELECT name FROM employees WHERE department = 'Design' OR department = 'Engineering' AND active = FALSE")).toEqual([
      "Maya",
      "Noah"
    ]);
  });

  it("executes parenthesised expressions", () => {
    expect(names("SELECT name FROM employees WHERE (department = 'Design' OR department = 'Engineering') AND active = FALSE")).toEqual([
      "Noah"
    ]);
  });

  it("validates all WHERE columns before execution", () => {
    expectExecutionError(() => execute("SELECT name FROM employees WHERE active = TRUE OR missing = TRUE"), "COLUMN_NOT_FOUND");
  });
});

describe("Executor ORDER BY", () => {
  it("sorts numbers ascending", () => {
    expect(names("SELECT name FROM employees ORDER BY salary ASC")).toEqual(["Maya", "Amira", "Noah", "Lina"]);
  });

  it("sorts numbers descending", () => {
    expect(names("SELECT name FROM employees ORDER BY salary DESC")).toEqual(["Noah", "Amira", "Maya", "Lina"]);
  });

  it("sorts strings ascending", () => {
    expect(names("SELECT name FROM employees ORDER BY name ASC")).toEqual(["Amira", "Lina", "Maya", "Noah"]);
  });

  it("sorts strings descending", () => {
    expect(names("SELECT name FROM employees ORDER BY name DESC")).toEqual(["Noah", "Maya", "Lina", "Amira"]);
  });

  it("sorts booleans ascending", () => {
    expect(names("SELECT name FROM employees ORDER BY active ASC")).toEqual(["Noah", "Amira", "Maya", "Lina"]);
  });

  it("sorts booleans descending", () => {
    expect(names("SELECT name FROM employees ORDER BY active DESC")).toEqual(["Amira", "Maya", "Lina", "Noah"]);
  });

  it("keeps nulls last in ascending order", () => {
    expect(names("SELECT name FROM employees ORDER BY salary ASC").at(-1)).toBe("Lina");
  });

  it("keeps nulls last in descending order", () => {
    expect(names("SELECT name FROM employees ORDER BY salary DESC").at(-1)).toBe("Lina");
  });

  it("sorts stably", () => {
    expect(names("SELECT name FROM employees ORDER BY department ASC")).toEqual(["Maya", "Amira", "Noah", "Lina"]);
  });

  it("sorts by a non-selected column", () => {
    expect(execute("SELECT name FROM employees ORDER BY salary DESC").rows[0]).toEqual({ name: "Noah" });
  });

  it("does not mutate stored row order", () => {
    const database = createEmployeesDatabase();
    execute("SELECT name FROM employees ORDER BY salary DESC", database);

    expect(database.getTable("employees").getRows().map((row) => row.name)).toEqual(["Amira", "Maya", "Noah", "Lina"]);
  });
});

describe("Executor LIMIT", () => {
  it("applies a basic limit", () => {
    expect(names("SELECT name FROM employees LIMIT 2")).toEqual(["Amira", "Maya"]);
  });

  it("supports limit zero", () => {
    expect(execute("SELECT name FROM employees LIMIT 0")).toEqual({
      type: "query",
      columns: ["name"],
      rows: [],
      rowCount: 0
    });
  });

  it("allows limits larger than the result size", () => {
    expect(execute("SELECT name FROM employees LIMIT 99").rowCount).toBe(4);
  });

  it("applies limit after filtering", () => {
    expect(names("SELECT name FROM employees WHERE department = 'Engineering' LIMIT 2")).toEqual(["Amira", "Noah"]);
  });

  it("applies limit after sorting", () => {
    expect(names("SELECT name FROM employees ORDER BY salary DESC LIMIT 2")).toEqual(["Noah", "Amira"]);
  });

  it("defensively rejects invalid AST limit values", () => {
    const statement = parseSelectStatement(tokenize("SELECT name FROM employees")) as SelectStatement & { limit: number };
    statement.limit = 1.5;

    expectExecutionError(() => new Executor(createEmployeesDatabase()).execute(statement), "INVALID_LIMIT");
  });
});

describe("Executor full queries", () => {
  it("executes WHERE with ORDER BY", () => {
    expect(names("SELECT name FROM employees WHERE department = 'Engineering' ORDER BY salary DESC")).toEqual(["Noah", "Amira", "Lina"]);
  });

  it("executes WHERE with LIMIT", () => {
    expect(names("SELECT name FROM employees WHERE department = 'Engineering' LIMIT 1")).toEqual(["Amira"]);
  });

  it("executes ORDER BY with LIMIT", () => {
    expect(names("SELECT name FROM employees ORDER BY name DESC LIMIT 2")).toEqual(["Noah", "Maya"]);
  });

  it("executes WHERE, ORDER BY, and LIMIT", () => {
    expect(names("SELECT name FROM employees WHERE department = 'Engineering' ORDER BY salary DESC LIMIT 2")).toEqual(["Noah", "Amira"]);
  });

  it("executes the full integration query through lexer, parser, and executor", () => {
    const sql = `SELECT name, salary
FROM employees
WHERE department = 'Engineering'
  AND salary >= 45000
ORDER BY salary DESC
LIMIT 5;`;

    expect(executeSql(createEmployeesDatabase(), sql)).toEqual({
      type: "query",
      columns: ["name", "salary"],
      rows: [
        { name: "Noah", salary: 52000 },
        { name: "Amira", salary: 48000 }
      ],
      rowCount: 2
    });
  });
});
