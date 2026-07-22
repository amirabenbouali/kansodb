import { describe, expect, it } from "vitest";
import { Parser, ParserError, ScriptParser, tokenize } from "../../src/index.js";

function parse(sql: string) {
  return new Parser(tokenize(sql)).parse();
}

describe("persistence parser", () => {
  it("parses SAVE forms", () => {
    expect(parse("SAVE")).toEqual({ type: "save_database" });
    expect(parse("SAVE;")).toEqual({ type: "save_database" });
    expect(parse("save")).toEqual({ type: "save_database" });
    expect(parse("SaVe")).toEqual({ type: "save_database" });
  });

  it("parses SAVE inside scripts", () => {
    expect(new ScriptParser(tokenize("SAVE; SELECT * FROM employees;")).parse()).toEqual([
      { type: "save_database" },
      expect.objectContaining({ type: "select" })
    ]);
  });

  it("rejects extra SAVE tokens", () => {
    expect(() => parse("SAVE DATABASE")).toThrow(ParserError);
    expect(() => parse("SAVE NOW")).toThrow(ParserError);
  });

  it("leaves existing statements unchanged", () => {
    expect(parse("BEGIN")).toEqual({ type: "begin_transaction" });
    expect(parse("SELECT * FROM employees")).toMatchObject({ type: "select" });
  });
});
