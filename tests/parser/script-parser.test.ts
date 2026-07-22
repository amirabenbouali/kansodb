import { describe, expect, it } from "vitest";
import { Parser, ParserError, ScriptParser, tokenize } from "../../src/index.js";

function parseScriptSql(sql: string) {
  return new ScriptParser(tokenize(sql), sql).parseWithMetadata();
}

describe("ScriptParser", () => {
  it("parses empty input", () => {
    expect(parseScriptSql("   \n\t  ")).toEqual([]);
  });

  it("parses one statement without semicolon", () => {
    expect(parseScriptSql("SELECT * FROM employees")).toHaveLength(1);
  });

  it("parses one statement with semicolon", () => {
    expect(parseScriptSql("SELECT * FROM employees;")).toHaveLength(1);
  });

  it("parses multiple statements", () => {
    expect(parseScriptSql("CREATE TABLE t (id INTEGER); INSERT INTO t VALUES (1); SELECT * FROM t;")).toHaveLength(3);
  });

  it("allows one trailing semicolon", () => {
    const statements = parseScriptSql("SELECT * FROM employees;");

    expect(statements).toHaveLength(1);
    expect(statements[0]?.statement.type).toBe("select");
  });

  it("allows whitespace between statements", () => {
    expect(parseScriptSql("SELECT * FROM a;\n\n  SELECT * FROM b")).toHaveLength(2);
  });

  it("parses mixed statement types", () => {
    expect(
      parseScriptSql(
        "CREATE TABLE t (id INTEGER); INSERT INTO t VALUES (1); UPDATE t SET id = 2; DELETE FROM t; SELECT * FROM t"
      ).map((entry) => entry.statement.type)
    ).toEqual(["create_table", "insert", "update", "delete", "select"]);
  });

  it("does not split on semicolons inside strings", () => {
    const statements = parseScriptSql("CREATE TABLE messages (id INTEGER, body TEXT); INSERT INTO messages VALUES (1, 'hello; world');");

    expect(statements).toHaveLength(2);
    expect(statements[1]?.sql).toBe("INSERT INTO messages VALUES (1, 'hello; world')");
  });

  it("rejects multiple semicolons as empty statements", () => {
    expect(() => parseScriptSql("SELECT * FROM employees;;")).toThrow(ParserError);
  });

  it("rejects missing separators", () => {
    expect(() => parseScriptSql("SELECT * FROM employees SELECT * FROM departments;")).toThrow(ParserError);
  });

  it("rejects syntax errors in the first statement", () => {
    expect(() => parseScriptSql("SELECT FROM employees; SELECT * FROM employees;")).toThrow(ParserError);
  });

  it("rejects syntax errors in later statements", () => {
    expect(() => parseScriptSql("SELECT * FROM employees; INSERT INTO employees VALUES ();")).toThrow(ParserError);
  });

  it("preserves accurate error positions", () => {
    try {
      parseScriptSql("SELECT * FROM employees; DELETE FROM;");
      throw new Error("Expected parser to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ParserError);
      expect(error).toMatchObject({ start: 36, end: 36 });
    }
  });

  it("keeps the existing single-statement parser working", () => {
    expect(new Parser(tokenize("SELECT * FROM employees")).parse()).toMatchObject({ type: "select" });
  });
});
