import { LexerError } from "../errors/lexer-error.js";
import { KEYWORDS, type Token, TokenType } from "./token.js";

export class Lexer {
  private readonly source: string;
  private tokens: Token[] = [];
  private start = 0;
  private current = 0;

  public constructor(source: string) {
    this.source = source;
  }

  public tokenize(): Token[] {
    while (!this.isAtEnd()) {
      this.start = this.current;
      this.scanToken();
    }

    this.tokens.push({
      type: TokenType.Eof,
      lexeme: "",
      start: this.current,
      end: this.current
    });

    return this.tokens;
  }

  private scanToken(): void {
    const char = this.advance();

    switch (char) {
      case " ":
      case "\r":
      case "\t":
      case "\n":
        return;
      case "*":
        this.addToken(TokenType.Star);
        return;
      case ",":
        this.addToken(TokenType.Comma);
        return;
      case ";":
        this.addToken(TokenType.Semicolon);
        return;
      case "(":
        this.addToken(TokenType.LeftParen);
        return;
      case ")":
        this.addToken(TokenType.RightParen);
        return;
      case "=":
        this.addToken(TokenType.Equal);
        return;
      case "!":
        this.scanBang();
        return;
      case ">":
        this.addToken(this.match("=") ? TokenType.GreaterEqual : TokenType.Greater);
        return;
      case "<":
        this.addToken(this.match("=") ? TokenType.LessEqual : TokenType.Less);
        return;
      case "-":
        this.addToken(TokenType.Minus);
        return;
      case "'":
        this.scanString();
        return;
      default:
        this.scanWordOrNumber(char);
    }
  }

  private scanBang(): void {
    if (this.match("=")) {
      this.addToken(TokenType.NotEqual);
      return;
    }

    throw new LexerError(`Unexpected character "!"`, this.start);
  }

  private scanWordOrNumber(char: string): void {
    if (this.isDigit(char)) {
      this.scanNumber();
      return;
    }

    if (this.isIdentifierStart(char)) {
      this.scanIdentifier();
      return;
    }

    throw new LexerError(`Unexpected character "${char}"`, this.start);
  }

  private scanIdentifier(): void {
    while (this.isIdentifierPart(this.peek())) {
      this.advance();
    }

    const lexeme = this.currentLexeme();
    const keywordType = KEYWORDS.get(lexeme.toUpperCase());

    if (keywordType === TokenType.True) {
      this.addToken(TokenType.True, true);
      return;
    }

    if (keywordType === TokenType.False) {
      this.addToken(TokenType.False, false);
      return;
    }

    if (keywordType === TokenType.Null) {
      this.addToken(TokenType.Null, null);
      return;
    }

    this.addToken(keywordType ?? TokenType.Identifier);
  }

  private scanNumber(): void {
    while (this.isDigit(this.peek())) {
      this.advance();
    }

    if (this.peek() === "." && this.isDigit(this.peekNext())) {
      this.advance();

      while (this.isDigit(this.peek())) {
        this.advance();
      }

      this.addToken(TokenType.Decimal, Number(this.currentLexeme()));
      return;
    }

    this.addToken(TokenType.Integer, Number.parseInt(this.currentLexeme(), 10));
  }

  private scanString(): void {
    let value = "";

    while (!this.isAtEnd()) {
      const char = this.advance();

      if (char !== "'") {
        value += char;
        continue;
      }

      if (this.peek() === "'") {
        this.advance();
        value += "'";
        continue;
      }

      this.addToken(TokenType.String, value);
      return;
    }

    throw new LexerError("Unterminated string", this.start);
  }

  private addToken(type: TokenType, literal?: Token["literal"]): void {
    const token: Token = {
      type,
      lexeme: this.currentLexeme(),
      start: this.start,
      end: this.current
    };

    if (literal !== undefined) {
      token.literal = literal;
    }

    this.tokens.push(token);
  }

  private currentLexeme(): string {
    return this.source.slice(this.start, this.current);
  }

  private advance(): string {
    const char = this.source[this.current];
    this.current += 1;
    return char ?? "";
  }

  private match(expected: string): boolean {
    if (this.isAtEnd() || this.source[this.current] !== expected) {
      return false;
    }

    this.current += 1;
    return true;
  }

  private peek(): string {
    return this.source[this.current] ?? "";
  }

  private peekNext(): string {
    return this.source[this.current + 1] ?? "";
  }

  private isAtEnd(): boolean {
    return this.current >= this.source.length;
  }

  private isDigit(char: string): boolean {
    return char >= "0" && char <= "9";
  }

  private isIdentifierStart(char: string): boolean {
    return this.isAlpha(char) || char === "_";
  }

  private isIdentifierPart(char: string): boolean {
    return this.isIdentifierStart(char) || this.isDigit(char);
  }

  private isAlpha(char: string): boolean {
    return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");
  }
}

export function tokenize(source: string): Token[] {
  return new Lexer(source).tokenize();
}
