import type { Token, TokenType } from "../lexer/token.js";

export class ParserError extends Error {
  public readonly token: Token;
  public readonly start: number;
  public readonly end: number;
  public readonly expected?: readonly TokenType[];

  public constructor(message: string, token: Token, expected?: readonly TokenType[]) {
    const expectedText = expected && expected.length > 0 ? ` Expected: ${expected.join(", ")}.` : "";

    super(`${message} at position ${token.start}.${expectedText}`);
    this.name = "ParserError";
    this.token = token;
    this.start = token.start;
    this.end = token.end;

    if (expected !== undefined) {
      this.expected = expected;
    }
  }
}
