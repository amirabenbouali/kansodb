import { describe, expect, it } from "vitest";
import { Parser, ParserError, parseSelectStatement, tokenize, TokenType } from "../src/index.js";

function parse(sql: string) {
  return parseSelectStatement(tokenize(sql));
}

describe("parser", () => {
  it("parses through the Parser.parse API", () => {
    expect(new Parser(tokenize("SELECT name FROM employees")).parse()).toEqual({
      type: "select",
      columns: [{ type: "column", name: "name" }],
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
    expect(parse("SELECT name FROM employees").columns).toEqual([{ type: "column", name: "name" }]);
  });

  it("parses multiple selected columns", () => {
    expect(parse("SELECT name, salary FROM employees").columns).toEqual([
      { type: "column", name: "name" },
      { type: "column", name: "salary" }
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
      column: "name",
      direction: "ASC"
    });
  });

  it("parses ORDER BY with DESC", () => {
    expect(parse("SELECT name FROM employees ORDER BY salary DESC").orderBy).toEqual({
      column: "salary",
      direction: "DESC"
    });
  });

  it("defaults ORDER BY direction to ASC", () => {
    expect(parse("SELECT name FROM employees ORDER BY name").orderBy).toEqual({
      column: "name",
      direction: "ASC"
    });
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
    expect(() => parse("SELECT name FROM employees name")).toThrow(ParserError);
    expect(() => parse("SELECT name FROM employees name")).toThrow("Unexpected token after complete SELECT statement");
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
          TokenType.Integer,
          TokenType.Decimal,
          TokenType.String,
          TokenType.True,
          TokenType.False,
          TokenType.Null
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
        { type: "column", name: "name" },
        { type: "column", name: "salary" }
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
        column: "salary",
        direction: "DESC"
      },
      limit: 5
    });
  });
});
