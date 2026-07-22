import { describe, expect, it } from "vitest";
import { filterTokens, getTokenDescription, getTokenKindLabel, type TokenInspectorToken } from "../../frontend/src/features/engine-inspector/tokenInspectorModel.js";

interface TestToken extends TokenInspectorToken {
  start: number;
  end: number;
}

function token(overrides: Partial<TestToken>): TestToken {
  return {
    type: "IDENTIFIER",
    lexeme: "employees",
    start: 0,
    end: 9,
    category: "identifier",
    ...overrides
  };
}

describe("TokenInspector helpers", () => {
  it("filters tokens by lexeme, raw type, and display kind", () => {
    const tokens = [
      token({ type: "SELECT", lexeme: "SELECT", category: "keyword" }),
      token({ type: "IDENTIFIER", lexeme: "salary", category: "identifier" }),
      token({ type: "INTEGER", lexeme: "5", literal: 5, category: "literal" })
    ];

    expect(filterTokens(tokens, "sal")).toEqual([tokens[1]]);
    expect(filterTokens(tokens, "integer")).toEqual([tokens[2]]);
    expect(filterTokens(tokens, "keyword")).toEqual([tokens[0]]);
  });

  it("uses beginner-readable token labels", () => {
    expect(getTokenKindLabel(token({ type: "SELECT", lexeme: "SELECT", category: "keyword" }))).toBe("Keyword");
    expect(getTokenKindLabel(token({ type: "STRING", lexeme: "'Amira'", literal: "Amira", category: "literal" }))).toBe("String");
    expect(getTokenKindLabel(token({ type: "GREATER_EQUAL", lexeme: ">=", category: "operator" }))).toBe("Operator");
    expect(getTokenKindLabel(token({ type: "SEMICOLON", lexeme: ";", category: "symbol" }))).toBe("Semicolon");
  });

  it("keeps descriptions lexer-focused", () => {
    expect(getTokenDescription(token({ type: "IDENTIFIER", lexeme: "employees", category: "identifier" }))).toContain("User-defined");
    expect(getTokenDescription(token({ type: "LEFT_PAREN", lexeme: "(", category: "symbol" }))).toBe("Grouping symbol.");
    expect(getTokenDescription(token({ type: "EOF", lexeme: "", category: "eof" }))).toBe("End of token stream.");
  });
});
