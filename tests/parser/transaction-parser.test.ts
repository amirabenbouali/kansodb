import { describe, expect, it } from "vitest";
import { Parser, ParserError, ScriptParser, tokenize } from "../../src/index.js";

function parse(sql: string) {
  return new Parser(tokenize(sql)).parse();
}

describe("transaction parser", () => {
  it("parses BEGIN forms", () => {
    expect(parse("BEGIN")).toEqual({ type: "begin_transaction" });
    expect(parse("BEGIN TRANSACTION;")).toEqual({ type: "begin_transaction" });
    expect(parse("begin")).toEqual({ type: "begin_transaction" });
    expect(parse("BeGiN TrAnSaCtIoN")).toEqual({ type: "begin_transaction" });
  });

  it("parses COMMIT and ROLLBACK", () => {
    expect(parse("COMMIT;")).toEqual({ type: "commit_transaction" });
    expect(parse("ROLLBACK;")).toEqual({ type: "rollback_transaction" });
  });

  it("parses transaction statements inside scripts", () => {
    expect(new ScriptParser(tokenize("BEGIN; COMMIT; ROLLBACK;")).parse()).toEqual([
      { type: "begin_transaction" },
      { type: "commit_transaction" },
      { type: "rollback_transaction" }
    ]);
  });

  it("rejects unsupported transaction syntax and extra tokens", () => {
    expect(() => parse("BEGIN WORK")).toThrow(ParserError);
    expect(() => parse("BEGIN TRANSACTION NOW")).toThrow(ParserError);
    expect(() => parse("COMMIT NOW")).toThrow(ParserError);
    expect(() => parse("ROLLBACK TO savepoint_name")).toThrow(ParserError);
    expect(() => parse("ROLLBACK TRANSACTION")).toThrow(ParserError);
  });

  it("leaves existing statement parsing unchanged", () => {
    expect(parse("SELECT * FROM accounts")).toMatchObject({ type: "select" });
  });
});
