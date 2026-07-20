import { describe, expect, it } from "vitest";
import { LexerError, tokenize, TokenType, type Token } from "../src/index.js";

function withoutEof(tokens: Token[]): Token[] {
  return tokens.slice(0, -1);
}

describe("lexer", () => {
  it("tokenizes a basic SELECT query", () => {
    const tokens = tokenize("SELECT name FROM employees WHERE id = 1;");

    expect(withoutEof(tokens).map((token) => token.type)).toEqual([
      TokenType.Select,
      TokenType.Identifier,
      TokenType.From,
      TokenType.Identifier,
      TokenType.Where,
      TokenType.Identifier,
      TokenType.Equal,
      TokenType.Integer,
      TokenType.Semicolon
    ]);
  });

  it("tokenizes SELECT *", () => {
    expect(withoutEof(tokenize("SELECT * FROM employees")).map((token) => token.type)).toEqual([
      TokenType.Select,
      TokenType.Star,
      TokenType.From,
      TokenType.Identifier
    ]);
  });

  it("tokenizes multiple selected columns", () => {
    const tokens = withoutEof(tokenize("SELECT name, salary FROM employees"));

    expect(tokens.map((token) => token.lexeme)).toEqual([
      "SELECT",
      "name",
      ",",
      "salary",
      "FROM",
      "employees"
    ]);
  });

  it("matches keywords case-insensitively", () => {
    const tokens = withoutEof(tokenize("select Name FrOm employees"));

    expect(tokens.map((token) => token.type)).toEqual([
      TokenType.Select,
      TokenType.Identifier,
      TokenType.From,
      TokenType.Identifier
    ]);
    expect(tokens[1]?.lexeme).toBe("Name");
  });

  it("tokenizes identifiers containing underscores and numbers", () => {
    const tokens = withoutEof(tokenize("SELECT employee_1, _dept2 FROM table_2026"));

    expect(tokens.filter((token) => token.type === TokenType.Identifier).map((token) => token.lexeme)).toEqual([
      "employee_1",
      "_dept2",
      "table_2026"
    ]);
  });

  it("tokenizes integer and decimal literals", () => {
    const tokens = withoutEof(tokenize("SELECT 42, 45000.75 FROM payroll"));

    expect(tokens.find((token) => token.type === TokenType.Integer)?.literal).toBe(42);
    expect(tokens.find((token) => token.type === TokenType.Decimal)?.literal).toBe(45000.75);
  });

  it("tokenizes string literals", () => {
    const token = withoutEof(tokenize("SELECT 'Engineering'"))[1];

    expect(token).toMatchObject({
      type: TokenType.String,
      lexeme: "'Engineering'",
      literal: "Engineering"
    });
  });

  it("supports escaped quotes inside strings", () => {
    const token = withoutEof(tokenize("SELECT 'Amira''s project'"))[1];

    expect(token).toMatchObject({
      type: TokenType.String,
      lexeme: "'Amira''s project'",
      literal: "Amira's project"
    });
  });

  it("tokenizes comparison operators", () => {
    const tokens = withoutEof(tokenize("a = 1 AND b != 2 OR c > 3 AND d >= 4 OR e < 5 AND f <= 6"));

    expect(tokens.map((token) => token.type)).toContain(TokenType.Equal);
    expect(tokens.map((token) => token.type)).toContain(TokenType.NotEqual);
    expect(tokens.map((token) => token.type)).toContain(TokenType.Greater);
    expect(tokens.map((token) => token.type)).toContain(TokenType.GreaterEqual);
    expect(tokens.map((token) => token.type)).toContain(TokenType.Less);
    expect(tokens.map((token) => token.type)).toContain(TokenType.LessEqual);
  });

  it("tokenizes boolean and NULL literals", () => {
    const tokens = withoutEof(tokenize("TRUE false Null"));

    expect(tokens).toEqual([
      { type: TokenType.True, lexeme: "TRUE", literal: true, start: 0, end: 4 },
      { type: TokenType.False, lexeme: "false", literal: false, start: 5, end: 10 },
      { type: TokenType.Null, lexeme: "Null", literal: null, start: 11, end: 15 }
    ]);
  });

  it("tokenizes parentheses", () => {
    const tokens = withoutEof(tokenize("WHERE (active = TRUE)"));

    expect(tokens.map((token) => token.type)).toEqual([
      TokenType.Where,
      TokenType.LeftParen,
      TokenType.Identifier,
      TokenType.Equal,
      TokenType.True,
      TokenType.RightParen
    ]);
  });

  it("throws on unexpected characters", () => {
    expect(() => tokenize("SELECT @")).toThrow(LexerError);
    expect(() => tokenize("SELECT @")).toThrow("Unexpected character \"@\" at position 7");
  });

  it("throws on unterminated strings", () => {
    expect(() => tokenize("SELECT 'Engineering")).toThrow(LexerError);
    expect(() => tokenize("SELECT 'Engineering")).toThrow("Unterminated string at position 7");
  });

  it("always appends an EOF token", () => {
    const tokens = tokenize("SELECT name");
    const eof = tokens.at(-1);

    expect(eof).toEqual({
      type: TokenType.Eof,
      lexeme: "",
      start: 11,
      end: 11
    });
  });

  it("tracks correct token positions", () => {
    const tokens = tokenize("SELECT name, salary\nFROM employees");

    expect(tokens.slice(0, 6)).toEqual([
      { type: TokenType.Select, lexeme: "SELECT", start: 0, end: 6 },
      { type: TokenType.Identifier, lexeme: "name", start: 7, end: 11 },
      { type: TokenType.Comma, lexeme: ",", start: 11, end: 12 },
      { type: TokenType.Identifier, lexeme: "salary", start: 13, end: 19 },
      { type: TokenType.From, lexeme: "FROM", start: 20, end: 24 },
      { type: TokenType.Identifier, lexeme: "employees", start: 25, end: 34 }
    ]);
  });

  it("tokenizes the integration query", () => {
    const query = `SELECT name, salary
FROM employees
WHERE department = 'Engineering'
  AND salary >= 45000
ORDER BY salary DESC
LIMIT 5;`;

    expect(withoutEof(tokenize(query)).map((token) => token.type)).toEqual([
      TokenType.Select,
      TokenType.Identifier,
      TokenType.Comma,
      TokenType.Identifier,
      TokenType.From,
      TokenType.Identifier,
      TokenType.Where,
      TokenType.Identifier,
      TokenType.Equal,
      TokenType.String,
      TokenType.And,
      TokenType.Identifier,
      TokenType.GreaterEqual,
      TokenType.Integer,
      TokenType.Order,
      TokenType.By,
      TokenType.Identifier,
      TokenType.Desc,
      TokenType.Limit,
      TokenType.Integer,
      TokenType.Semicolon
    ]);
  });

  it("tokenizes CREATE TABLE keywords", () => {
    expect(withoutEof(tokenize("CREATE TABLE employees")).map((token) => token.type)).toEqual([
      TokenType.Create,
      TokenType.Table,
      TokenType.Identifier
    ]);
  });

  it("tokenizes INSERT INTO keywords", () => {
    expect(withoutEof(tokenize("INSERT INTO employees")).map((token) => token.type)).toEqual([
      TokenType.Insert,
      TokenType.Into,
      TokenType.Identifier
    ]);
  });

  it("tokenizes VALUES", () => {
    expect(withoutEof(tokenize("VALUES (1)")).map((token) => token.type)).toEqual([
      TokenType.Values,
      TokenType.LeftParen,
      TokenType.Integer,
      TokenType.RightParen
    ]);
  });

  it("tokenizes data-type keywords", () => {
    expect(withoutEof(tokenize("INTEGER DECIMAL TEXT BOOLEAN")).map((token) => token.type)).toEqual([
      TokenType.IntegerType,
      TokenType.DecimalType,
      TokenType.TextType,
      TokenType.BooleanType
    ]);
  });

  it("tokenizes NOT NULL", () => {
    expect(withoutEof(tokenize("NOT NULL")).map((token) => token.type)).toEqual([TokenType.Not, TokenType.Null]);
  });

  it("tokenizes lowercase and mixed-case DDL/DML keywords", () => {
    expect(withoutEof(tokenize("create TaBlE insert InTo values integer text not null")).map((token) => token.type)).toEqual([
      TokenType.Create,
      TokenType.Table,
      TokenType.Insert,
      TokenType.Into,
      TokenType.Values,
      TokenType.IntegerType,
      TokenType.TextType,
      TokenType.Not,
      TokenType.Null
    ]);
  });
});
