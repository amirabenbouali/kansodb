import { describe, expect, it } from "vitest";
import { Parser, ParserError, parseSelectStatement, tokenize, TokenType } from "../src/index.js";

function parse(sql: string) {
  return parseSelectStatement(tokenize(sql));
}

function parseStatement(sql: string) {
  return new Parser(tokenize(sql)).parse();
}

function selectExpression(expression: object, alias?: string) {
  return alias === undefined
    ? { type: "select_expression", expression }
    : { type: "select_expression", expression, alias };
}

describe("parser", () => {
  it("parses through the Parser.parse API", () => {
    expect(new Parser(tokenize("SELECT name FROM employees")).parse()).toEqual({
      type: "select",
      columns: [selectExpression({ type: "column", name: "name" })],
      from: { type: "table", name: "employees" }
    });
  });

  it("parses SELECT *", () => {
    expect(parse("SELECT * FROM employees")).toEqual({
      type: "select",
      columns: [{ type: "wildcard" }],
      from: { type: "table", name: "employees" }
    });
  });

  it("parses one selected column", () => {
    expect(parse("SELECT name FROM employees").columns).toEqual([selectExpression({ type: "column", name: "name" })]);
  });

  it("parses multiple selected columns", () => {
    expect(parse("SELECT name, salary FROM employees").columns).toEqual([
      selectExpression({ type: "column", name: "name" }),
      selectExpression({ type: "column", name: "salary" })
    ]);
  });

  it("parses WHERE with a numeric comparison", () => {
    expect(parse("SELECT name FROM employees WHERE salary >= 45000").where).toEqual({
      type: "comparison",
      operator: ">=",
      left: { type: "column", name: "salary" },
      right: { type: "literal", value: 45000 }
    });
  });

  it("parses WHERE with a string comparison", () => {
    expect(parse("SELECT name FROM employees WHERE department = 'Engineering'").where).toEqual({
      type: "comparison",
      operator: "=",
      left: { type: "column", name: "department" },
      right: { type: "literal", value: "Engineering" }
    });
  });

  it("parses boolean and NULL literals", () => {
    expect(parse("SELECT name FROM employees WHERE active = TRUE").where).toMatchObject({
      right: { type: "literal", value: true }
    });
    expect(parse("SELECT name FROM employees WHERE archived = FALSE").where).toMatchObject({
      right: { type: "literal", value: false }
    });
    expect(parse("SELECT name FROM employees WHERE manager = NULL").where).toMatchObject({
      right: { type: "literal", value: null }
    });
  });

  it("parses AND expressions", () => {
    expect(parse("SELECT name FROM employees WHERE active = TRUE AND salary > 1000").where).toMatchObject({
      type: "logical",
      operator: "AND"
    });
  });

  it("parses OR expressions", () => {
    expect(parse("SELECT name FROM employees WHERE active = TRUE OR salary > 1000").where).toMatchObject({
      type: "logical",
      operator: "OR"
    });
  });

  it("gives AND higher precedence than OR", () => {
    expect(parse("SELECT name FROM employees WHERE a = 1 OR b = 2 AND c = 3").where).toEqual({
      type: "logical",
      operator: "OR",
      left: {
        type: "comparison",
        operator: "=",
        left: { type: "column", name: "a" },
        right: { type: "literal", value: 1 }
      },
      right: {
        type: "logical",
        operator: "AND",
        left: {
          type: "comparison",
          operator: "=",
          left: { type: "column", name: "b" },
          right: { type: "literal", value: 2 }
        },
        right: {
          type: "comparison",
          operator: "=",
          left: { type: "column", name: "c" },
          right: { type: "literal", value: 3 }
        }
      }
    });
  });

  it("lets parentheses override precedence", () => {
    expect(parse("SELECT name FROM employees WHERE (a = 1 OR b = 2) AND c = 3").where).toMatchObject({
      type: "logical",
      operator: "AND",
      left: {
        type: "logical",
        operator: "OR"
      }
    });
  });

  it("parses ORDER BY with ASC", () => {
    expect(parse("SELECT name FROM employees ORDER BY name ASC").orderBy).toEqual({
      items: [{ expression: { type: "result_alias", name: "name" }, direction: "ASC" }]
    });
  });

  it("parses ORDER BY with DESC", () => {
    expect(parse("SELECT name FROM employees ORDER BY salary DESC").orderBy).toEqual({
      items: [{ expression: { type: "result_alias", name: "salary" }, direction: "DESC" }]
    });
  });

  it("defaults ORDER BY direction to ASC", () => {
    expect(parse("SELECT name FROM employees ORDER BY name").orderBy).toEqual({
      items: [{ expression: { type: "result_alias", name: "name" }, direction: "ASC" }]
    });
  });

  it("parses qualified column references", () => {
    expect(parse("SELECT e.name FROM employees e WHERE e.id = 1 ORDER BY e.name")).toMatchObject({
      columns: [selectExpression({ type: "column", qualifier: "e", name: "name" })],
      from: { type: "table", name: "employees", alias: "e" },
      where: { type: "comparison", left: { type: "column", qualifier: "e", name: "id" } },
      orderBy: { items: [{ expression: { type: "column", qualifier: "e", name: "name" }, direction: "ASC" }] }
    });
  });

  it("parses table aliases with AS", () => {
    expect(parse("SELECT e.name FROM employees AS e")).toMatchObject({
      from: { type: "table", name: "employees", alias: "e" }
    });
  });

  it("parses INNER JOIN clauses", () => {
    expect(parse("SELECT e.name, d.name FROM employees e INNER JOIN departments d ON e.department_id = d.id")).toMatchObject({
      from: { type: "table", name: "employees", alias: "e" },
      joins: [
        {
          type: "join",
          joinType: "INNER",
          table: { type: "table", name: "departments", alias: "d" },
          on: {
            type: "join_condition",
            left: { type: "column", qualifier: "e", name: "department_id" },
            operator: "=",
            right: { type: "column", qualifier: "d", name: "id" }
          }
        }
      ]
    });
  });

  it("treats bare JOIN as INNER JOIN", () => {
    expect(parse("SELECT employees.name FROM employees JOIN departments ON employees.department_id = departments.id")).toMatchObject({
      joins: [
        {
          type: "join",
          joinType: "INNER",
          table: { type: "table", name: "departments" }
        }
      ]
    });
  });

  it("rejects invalid JOIN syntax", () => {
    expect(() => parse("SELECT e.name FROM employees e INNER departments d ON e.department_id = d.id")).toThrow(ParserError);
    expect(() => parse("SELECT e.name FROM employees e JOIN departments d e.department_id = d.id")).toThrow(ParserError);
    expect(() => parse("SELECT e.name FROM employees e JOIN departments d ON e.department_id != d.id")).toThrow(ParserError);
  });

  it("parses LIMIT", () => {
    expect(parse("SELECT name FROM employees LIMIT 5").limit).toBe(5);
  });

  it("allows one optional semicolon", () => {
    expect(parse("SELECT name FROM employees;")).toMatchObject({
      type: "select",
      from: { type: "table", name: "employees" }
    });
  });

  it("rejects missing SELECT", () => {
    expect(() => parse("name FROM employees")).toThrow(ParserError);
    expect(() => parse("name FROM employees")).toThrow("Expected SELECT");
  });

  it("rejects missing FROM", () => {
    expect(() => parse("SELECT name employees")).toThrow(ParserError);
    expect(() => parse("SELECT name employees")).toThrow("Expected FROM");
  });

  it("rejects missing table name", () => {
    expect(() => parse("SELECT name FROM")).toThrow(ParserError);
    expect(() => parse("SELECT name FROM")).toThrow("Expected table name");
  });

  it("rejects a trailing comma in the select list", () => {
    expect(() => parse("SELECT name, FROM employees")).toThrow(ParserError);
    expect(() => parse("SELECT name, FROM employees")).toThrow("Expected column name after comma");
  });

  it("rejects a missing comparison value", () => {
    expect(() => parse("SELECT name FROM employees WHERE salary >")).toThrow(ParserError);
    expect(() => parse("SELECT name FROM employees WHERE salary >")).toThrow("Expected comparison value");
  });

  it("rejects invalid comparison operators", () => {
    expect(() => parse("SELECT name FROM employees WHERE salary 45000")).toThrow(ParserError);
    expect(() => parse("SELECT name FROM employees WHERE salary 45000")).toThrow("Expected comparison operator");
  });

  it("rejects decimal LIMIT values", () => {
    expect(() => parse("SELECT name FROM employees LIMIT 5.5")).toThrow(ParserError);
    expect(() => parse("SELECT name FROM employees LIMIT 5.5")).toThrow("LIMIT only accepts non-negative integers");
  });

  it("rejects negative LIMIT values", () => {
    expect(() => parse("SELECT name FROM employees LIMIT -1")).toThrow(ParserError);
    expect(() => parse("SELECT name FROM employees LIMIT -1")).toThrow("LIMIT only accepts non-negative integers");
  });

  it("rejects unexpected trailing tokens", () => {
    expect(() => parse("SELECT name FROM employees alias extra")).toThrow(ParserError);
    expect(() => parse("SELECT name FROM employees alias extra")).toThrow("Unexpected token after complete SELECT statement");
  });

  it("reports accurate parser error positions", () => {
    try {
      parse("SELECT name FROM employees WHERE salary > ORDER");
      throw new Error("Expected parser to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ParserError);
      expect(error).toMatchObject({
        start: 42,
        end: 47,
        expected: [
          TokenType.Identifier,
          TokenType.Integer,
          TokenType.Decimal,
          TokenType.String,
          TokenType.True,
          TokenType.False,
          TokenType.Null,
          TokenType.LeftParen
        ]
      });
    }
  });

  it("rejects more than one trailing semicolon", () => {
    expect(() => parse("SELECT name FROM employees;;")).toThrow(ParserError);
    expect(() => parse("SELECT name FROM employees;;")).toThrow("Only one trailing semicolon is allowed");
  });

  it("parses the integration query", () => {
    const query = `SELECT name, salary
FROM employees
WHERE department = 'Engineering'
  AND salary >= 45000
ORDER BY salary DESC
LIMIT 5;`;

    expect(parse(query)).toEqual({
      type: "select",
      columns: [
        selectExpression({ type: "column", name: "name" }),
        selectExpression({ type: "column", name: "salary" })
      ],
      from: { type: "table", name: "employees" },
      where: {
        type: "logical",
        operator: "AND",
        left: {
          type: "comparison",
          operator: "=",
          left: { type: "column", name: "department" },
          right: { type: "literal", value: "Engineering" }
        },
        right: {
          type: "comparison",
          operator: ">=",
          left: { type: "column", name: "salary" },
          right: { type: "literal", value: 45000 }
        }
      },
      orderBy: {
        items: [{ expression: { type: "result_alias", name: "salary" }, direction: "DESC" }]
      },
      limit: 5
    });
  });
});

describe("CREATE TABLE parser", () => {
  it("parses a one-column table", () => {
    expect(parseStatement("CREATE TABLE employees (id INTEGER)")).toEqual({
      type: "create_table",
      tableName: "employees",
      columns: [{ name: "id", dataType: "INTEGER", nullable: false, unique: false, primaryKey: false }]
    });
  });

  it("parses multiple columns", () => {
    expect(parseStatement("CREATE TABLE employees (id INTEGER, name TEXT)")).toMatchObject({
      columns: [
        { name: "id", dataType: "INTEGER", nullable: false },
        { name: "name", dataType: "TEXT", nullable: false }
      ]
    });
  });

  it("parses every supported data type", () => {
    expect(parseStatement("CREATE TABLE t (a INTEGER, b DECIMAL, c TEXT, d BOOLEAN)")).toMatchObject({
      columns: [
        { dataType: "INTEGER" },
        { dataType: "DECIMAL" },
        { dataType: "TEXT" },
        { dataType: "BOOLEAN" }
      ]
    });
  });

  it("defaults columns to non-nullable", () => {
    expect(parseStatement("CREATE TABLE t (id INTEGER)")).toMatchObject({ columns: [{ nullable: false }] });
  });

  it("parses explicit NULL", () => {
    expect(parseStatement("CREATE TABLE t (salary DECIMAL NULL)")).toMatchObject({ columns: [{ nullable: true }] });
  });

  it("parses explicit NOT NULL", () => {
    expect(parseStatement("CREATE TABLE t (name TEXT NOT NULL)")).toMatchObject({ columns: [{ nullable: false }] });
  });

  it("allows an optional semicolon", () => {
    expect(parseStatement("CREATE TABLE t (id INTEGER);")).toMatchObject({ type: "create_table", tableName: "t" });
  });

  it("matches keywords case-insensitively", () => {
    expect(parseStatement("create table Employees (id integer, name TeXt null)")).toEqual({
      type: "create_table",
      tableName: "Employees",
      columns: [
        { name: "id", dataType: "INTEGER", nullable: false, unique: false, primaryKey: false },
        { name: "name", dataType: "TEXT", nullable: true, unique: false, primaryKey: false }
      ]
    });
  });

  it("rejects an empty column list", () => {
    expect(() => parseStatement("CREATE TABLE employees ()")).toThrow(ParserError);
  });

  it("rejects a missing table name", () => {
    expect(() => parseStatement("CREATE TABLE (id INTEGER)")).toThrow(ParserError);
  });

  it("rejects a missing opening parenthesis", () => {
    expect(() => parseStatement("CREATE TABLE employees id INTEGER)")).toThrow(ParserError);
  });

  it("rejects a missing closing parenthesis", () => {
    expect(() => parseStatement("CREATE TABLE employees (id INTEGER")).toThrow(ParserError);
  });

  it("rejects a missing column type", () => {
    expect(() => parseStatement("CREATE TABLE employees (id)")).toThrow(ParserError);
  });

  it("rejects an unsupported column type", () => {
    expect(() => parseStatement("CREATE TABLE employees (id UNKNOWN)")).toThrow(ParserError);
  });

  it("rejects a trailing comma", () => {
    expect(() => parseStatement("CREATE TABLE employees (id INTEGER,)")).toThrow(ParserError);
  });

  it("rejects an invalid NOT modifier", () => {
    expect(() => parseStatement("CREATE TABLE employees (id INTEGER NOT)")).toThrow(ParserError);
  });

  it("rejects conflicting nullability modifiers", () => {
    expect(() => parseStatement("CREATE TABLE employees (id INTEGER NULL NOT NULL)")).toThrow(ParserError);
  });

  it("rejects unexpected trailing tokens", () => {
    expect(() => parseStatement("CREATE TABLE employees (id INTEGER) SELECT")).toThrow(ParserError);
  });
});

describe("INSERT parser", () => {
  it("parses a positional insert", () => {
    expect(parseStatement("INSERT INTO employees VALUES (1, 'Amira', TRUE)")).toEqual({
      type: "insert",
      tableName: "employees",
      values: [
        { type: "literal", value: 1 },
        { type: "literal", value: "Amira" },
        { type: "literal", value: true }
      ]
    });
  });

  it("parses a named-column insert", () => {
    expect(parseStatement("INSERT INTO employees (id, name) VALUES (1, 'Amira')")).toEqual({
      type: "insert",
      tableName: "employees",
      columns: ["id", "name"],
      values: [
        { type: "literal", value: 1 },
        { type: "literal", value: "Amira" }
      ]
    });
  });

  it("preserves reordered named columns", () => {
    expect(parseStatement("INSERT INTO employees (name, id) VALUES ('Amira', 1)")).toMatchObject({
      columns: ["name", "id"]
    });
  });

  it("parses integer, decimal, string, boolean, and NULL values", () => {
    expect(parseStatement("INSERT INTO t VALUES (1, 2.5, 'x', FALSE, NULL)")).toMatchObject({
      values: [
        { value: 1 },
        { value: 2.5 },
        { value: "x" },
        { value: false },
        { value: null }
      ]
    });
  });

  it("allows an optional semicolon", () => {
    expect(parseStatement("INSERT INTO employees VALUES (1);")).toMatchObject({ type: "insert" });
  });

  it("matches keywords case-insensitively", () => {
    expect(parseStatement("insert into Employees values (TRUE)")).toMatchObject({
      type: "insert",
      tableName: "Employees",
      values: [{ value: true }]
    });
  });

  it("rejects a missing table name", () => {
    expect(() => parseStatement("INSERT INTO VALUES (1)")).toThrow(ParserError);
  });

  it("rejects an empty value list", () => {
    expect(() => parseStatement("INSERT INTO employees VALUES ()")).toThrow(ParserError);
  });

  it("rejects a trailing column comma", () => {
    expect(() => parseStatement("INSERT INTO employees (id, name,) VALUES (1, 'Amira')")).toThrow(ParserError);
  });

  it("rejects a trailing value comma", () => {
    expect(() => parseStatement("INSERT INTO employees VALUES (1,)")).toThrow(ParserError);
  });

  it("rejects a missing VALUES keyword", () => {
    expect(() => parseStatement("INSERT INTO employees (id) (1)")).toThrow(ParserError);
  });

  it("rejects mismatched parentheses", () => {
    expect(() => parseStatement("INSERT INTO employees VALUES (1, 2")).toThrow(ParserError);
  });

  it("rejects identifiers used as values", () => {
    expect(() => parseStatement("INSERT INTO employees VALUES (1, salary)")).toThrow(ParserError);
  });

  it("rejects unexpected trailing tokens", () => {
    expect(() => parseStatement("INSERT INTO employees VALUES (1) SELECT")).toThrow(ParserError);
  });
});

describe("UPDATE parser", () => {
  it("parses one assignment", () => {
    expect(parseStatement("UPDATE employees SET salary = 50000")).toEqual({
      type: "update",
      tableName: "employees",
      assignments: [{ columnName: "salary", value: { type: "literal", value: 50000 } }]
    });
  });

  it("parses multiple assignments", () => {
    expect(parseStatement("UPDATE employees SET salary = 50000, active = FALSE")).toMatchObject({
      assignments: [
        { columnName: "salary", value: { value: 50000 } },
        { columnName: "active", value: { value: false } }
      ]
    });
  });

  it("parses integer, decimal, string, boolean, and null assignments", () => {
    expect(parseStatement("UPDATE t SET a = 1, b = 2.5, c = 'x', d = TRUE, e = NULL")).toMatchObject({
      assignments: [{ value: { value: 1 } }, { value: { value: 2.5 } }, { value: { value: "x" } }, { value: { value: true } }, { value: { value: null } }]
    });
  });

  it("parses update without WHERE", () => {
    const statement = parseStatement("UPDATE employees SET active = FALSE");

    expect(statement).toMatchObject({ type: "update" });
    expect("where" in statement).toBe(false);
  });

  it("parses update with WHERE", () => {
    expect(parseStatement("UPDATE employees SET active = FALSE WHERE id = 1")).toMatchObject({
      where: { type: "comparison", operator: "=" }
    });
  });

  it("parses update with AND", () => {
    expect(parseStatement("UPDATE employees SET active = FALSE WHERE id = 1 AND name = 'Amira'")).toMatchObject({
      where: { type: "logical", operator: "AND" }
    });
  });

  it("parses update with OR", () => {
    expect(parseStatement("UPDATE employees SET active = FALSE WHERE id = 1 OR name = 'Maya'")).toMatchObject({
      where: { type: "logical", operator: "OR" }
    });
  });

  it("parses parenthesised update WHERE", () => {
    expect(parseStatement("UPDATE employees SET active = FALSE WHERE (id = 1 OR id = 2) AND active = TRUE")).toMatchObject({
      where: { type: "logical", operator: "AND", left: { type: "logical", operator: "OR" } }
    });
  });

  it("allows an optional semicolon", () => {
    expect(parseStatement("UPDATE employees SET active = FALSE;")).toMatchObject({ type: "update" });
  });

  it("matches keywords case-insensitively", () => {
    expect(parseStatement("update Employees set Active = false where id = 1")).toMatchObject({
      type: "update",
      tableName: "Employees",
      assignments: [{ columnName: "Active", value: { value: false } }]
    });
  });

  it("rejects a missing table name", () => {
    expect(() => parseStatement("UPDATE SET active = FALSE")).toThrow(ParserError);
  });

  it("rejects missing SET", () => {
    expect(() => parseStatement("UPDATE employees active = FALSE")).toThrow(ParserError);
  });

  it("rejects an empty assignment list", () => {
    expect(() => parseStatement("UPDATE employees SET;")).toThrow(ParserError);
  });

  it("rejects a missing equals sign", () => {
    expect(() => parseStatement("UPDATE employees SET salary")).toThrow(ParserError);
  });

  it("rejects a missing assignment value", () => {
    expect(() => parseStatement("UPDATE employees SET salary =")).toThrow(ParserError);
  });

  it("rejects a trailing assignment comma", () => {
    expect(() => parseStatement("UPDATE employees SET salary = 50000,")).toThrow(ParserError);
  });

  it("parses identifiers used as assignment values", () => {
    expect(parseStatement("UPDATE employees SET salary = salary")).toMatchObject({
      assignments: [{ columnName: "salary", value: { type: "column", name: "salary" } }]
    });
  });

  it("rejects unexpected trailing tokens", () => {
    expect(() => parseStatement("UPDATE employees SET active = FALSE SELECT")).toThrow(ParserError);
  });
});

describe("DELETE parser", () => {
  it("parses delete without WHERE", () => {
    expect(parseStatement("DELETE FROM employees")).toEqual({
      type: "delete",
      tableName: "employees"
    });
  });

  it("parses delete with WHERE", () => {
    expect(parseStatement("DELETE FROM employees WHERE active = FALSE")).toMatchObject({
      type: "delete",
      where: { type: "comparison", operator: "=" }
    });
  });

  it("parses delete with AND", () => {
    expect(parseStatement("DELETE FROM employees WHERE active = FALSE AND department = 'Engineering'")).toMatchObject({
      where: { type: "logical", operator: "AND" }
    });
  });

  it("parses delete with OR", () => {
    expect(parseStatement("DELETE FROM employees WHERE active = FALSE OR department = 'Design'")).toMatchObject({
      where: { type: "logical", operator: "OR" }
    });
  });

  it("parses parenthesised delete WHERE", () => {
    expect(parseStatement("DELETE FROM employees WHERE (active = FALSE OR department = 'Design') AND id > 1")).toMatchObject({
      where: { type: "logical", operator: "AND", left: { type: "logical", operator: "OR" } }
    });
  });

  it("allows an optional semicolon", () => {
    expect(parseStatement("DELETE FROM employees;")).toMatchObject({ type: "delete" });
  });

  it("matches keywords case-insensitively", () => {
    expect(parseStatement("delete from Employees where active = false")).toMatchObject({
      type: "delete",
      tableName: "Employees"
    });
  });

  it("rejects missing FROM", () => {
    expect(() => parseStatement("DELETE employees;")).toThrow(ParserError);
  });

  it("rejects a missing table name", () => {
    expect(() => parseStatement("DELETE FROM;")).toThrow(ParserError);
  });

  it("rejects an empty WHERE", () => {
    expect(() => parseStatement("DELETE FROM employees WHERE;")).toThrow(ParserError);
  });

  it("rejects unexpected trailing tokens", () => {
    expect(() => parseStatement("DELETE FROM employees SELECT")).toThrow(ParserError);
  });
});

describe("aggregate SELECT parser", () => {
  it("parses aggregate expressions", () => {
    expect(parseStatement("SELECT COUNT(*), COUNT(id), SUM(salary), AVG(salary), MIN(name), MAX(active) FROM employees")).toMatchObject({
      type: "select",
      columns: [
        selectExpression({ type: "aggregate", function: "COUNT", argument: { type: "wildcard" } }),
        selectExpression({ type: "aggregate", function: "COUNT", argument: { type: "column", name: "id" } }),
        selectExpression({ type: "aggregate", function: "SUM", argument: { type: "column", name: "salary" } }),
        selectExpression({ type: "aggregate", function: "AVG", argument: { type: "column", name: "salary" } }),
        selectExpression({ type: "aggregate", function: "MIN", argument: { type: "column", name: "name" } }),
        selectExpression({ type: "aggregate", function: "MAX", argument: { type: "column", name: "active" } })
      ]
    });
  });

  it("parses aggregates mixed with columns and case-insensitive function names", () => {
    expect(parseStatement("select department, count(*) from employees")).toMatchObject({
      columns: [
        selectExpression({ type: "column", name: "department" }),
        selectExpression({ type: "aggregate", function: "COUNT", argument: { type: "wildcard" } })
      ]
    });
  });

  it("rejects malformed aggregate calls", () => {
    expect(() => parseStatement("SELECT COUNT* FROM employees")).toThrow(ParserError);
    expect(() => parseStatement("SELECT COUNT(*) FROM employees")).not.toThrow();
    expect(() => parseStatement("SELECT COUNT( FROM employees")).toThrow(ParserError);
    expect(() => parseStatement("SELECT COUNT() FROM employees")).toThrow(ParserError);
    expect(() => parseStatement("SELECT COUNT(id, name) FROM employees")).toThrow(ParserError);
    expect(() => parseStatement("SELECT SUM(*) FROM employees")).toThrow(ParserError);
    expect(() => parseStatement("SELECT AVG(*) FROM employees")).toThrow(ParserError);
    expect(() => parseStatement("SELECT MIN(*) FROM employees")).toThrow(ParserError);
    expect(() => parseStatement("SELECT MAX(*) FROM employees")).toThrow(ParserError);
    expect(() => parseStatement("SELECT SUM(AVG(salary)) FROM employees")).toThrow(ParserError);
    expect(() => parseStatement("SELECT COUNT(id) FROM employees alias trailing")).toThrow(ParserError);
  });
});

describe("GROUP BY parser", () => {
  it("parses one and multiple group-by columns", () => {
    expect(parseStatement("SELECT department, COUNT(*) FROM employees GROUP BY department")).toMatchObject({
      groupBy: [{ type: "column", name: "department" }]
    });
    expect(parseStatement("SELECT department, active, COUNT(*) FROM employees GROUP BY department, active")).toMatchObject({
      groupBy: [
        { type: "column", name: "department" },
        { type: "column", name: "active" }
      ]
    });
  });

  it("parses GROUP BY after WHERE and before ORDER BY or LIMIT", () => {
    expect(parseStatement("SELECT department, COUNT(*) FROM employees WHERE active = TRUE GROUP BY department")).toMatchObject({
      where: { type: "comparison" },
      groupBy: [{ name: "department" }]
    });
    expect(parseStatement("SELECT department, COUNT(*) FROM employees GROUP BY department ORDER BY department ASC")).toMatchObject({
      groupBy: [{ name: "department" }],
      orderBy: { items: [{ expression: { type: "result_alias", name: "department" }, direction: "ASC" }] }
    });
    expect(parseStatement("SELECT department, COUNT(*) FROM employees GROUP BY department LIMIT 1")).toMatchObject({
      groupBy: [{ name: "department" }],
      limit: 1
    });
  });

  it("matches GROUP BY keywords case-insensitively", () => {
    expect(parseStatement("select department from employees group by department")).toMatchObject({
      groupBy: [{ name: "department" }]
    });
  });

  it("rejects invalid GROUP BY syntax and clause order", () => {
    expect(() => parseStatement("SELECT department, COUNT(*) FROM employees GROUP")).toThrow(ParserError);
    expect(() => parseStatement("SELECT department, COUNT(*) FROM employees GROUP BY")).toThrow(ParserError);
    expect(() => parseStatement("SELECT department, COUNT(*) FROM employees GROUP BY department,")).toThrow(ParserError);
    expect(() => parseStatement("SELECT department, COUNT(*) FROM employees ORDER BY department GROUP BY department")).toThrow(ParserError);
  });

  it("keeps existing SELECT parsing unchanged", () => {
    expect(parseStatement("SELECT name FROM employees WHERE active = TRUE ORDER BY name LIMIT 1")).toMatchObject({
      type: "select",
      columns: [selectExpression({ type: "column", name: "name" })],
      orderBy: { items: [{ expression: { type: "result_alias", name: "name" }, direction: "ASC" }] },
      limit: 1
    });
  });
});
