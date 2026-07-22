import { ParserError } from "../errors/parser-error.js";
import type { Token } from "../lexer/token.js";
import { TokenType } from "../lexer/token.js";
import type { Statement } from "./ast.js";
import { Parser } from "./parser.js";

export interface ParsedScriptStatement {
  statement: Statement;
  sql?: string;
}

export class ScriptParser {
  private readonly tokens: Token[];
  private readonly source: string | undefined;
  private current = 0;

  public constructor(tokens: Token[], source?: string) {
    this.tokens = tokens;
    this.source = source;
  }

  public parse(): Statement[] {
    return this.parseWithMetadata().map((entry) => entry.statement);
  }

  public parseWithMetadata(): ParsedScriptStatement[] {
    const statements: ParsedScriptStatement[] = [];

    if (this.isAtEnd()) {
      return statements;
    }

    while (!this.isAtEnd()) {
      if (this.check(TokenType.Semicolon)) {
        throw new ParserError("Empty statements are not supported", this.peek(), [
          TokenType.Select,
          TokenType.Create,
          TokenType.Insert,
          TokenType.Update,
          TokenType.Delete,
          TokenType.Begin,
          TokenType.Commit,
          TokenType.Rollback,
          TokenType.Save
        ]);
      }

      statements.push(this.parseStatementEntry());

      if (this.isAtEnd()) {
        break;
      }

      this.consume(TokenType.Semicolon, "Expected semicolon between statements");

      if (this.check(TokenType.Semicolon)) {
        throw new ParserError("Empty statements are not supported", this.peek(), [
          TokenType.Select,
          TokenType.Create,
          TokenType.Insert,
          TokenType.Update,
          TokenType.Delete,
          TokenType.Begin,
          TokenType.Commit,
          TokenType.Rollback,
          TokenType.Save
        ]);
      }
    }

    return statements;
  }

  private parseStatementEntry(): ParsedScriptStatement {
    const start = this.current;

    while (!this.isAtEnd() && !this.check(TokenType.Semicolon)) {
      this.current += 1;
    }

    const statementTokens = this.tokens.slice(start, this.current);
    const eofPosition = statementTokens.at(-1)?.end ?? this.peek().start;
    const parser = new Parser([
      ...statementTokens,
      {
        type: TokenType.Eof,
        lexeme: "",
        start: eofPosition,
        end: eofPosition
      }
    ]);

    const entry: ParsedScriptStatement = {
      statement: parser.parse()
    };

    if (this.source !== undefined) {
      entry.sql = this.source.slice(statementTokens[0]?.start ?? 0, eofPosition).trim();
    }

    return entry;
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) {
      const token = this.peek();
      this.current += 1;
      return token;
    }

    throw new ParserError(message, this.peek(), [type]);
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.Eof;
  }

  private peek(): Token {
    return this.tokens[this.current] ?? this.tokens[this.tokens.length - 1] ?? {
      type: TokenType.Eof,
      lexeme: "",
      start: 0,
      end: 0
    };
  }
}

export function parseScript(tokens: Token[]): Statement[] {
  return new ScriptParser(tokens).parse();
}
