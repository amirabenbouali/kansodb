import type {
  ColumnReference,
  ComparisonExpression,
  ComparisonOperator,
  Expression,
  LiteralExpression,
  LogicalExpression,
  LogicalOperator,
  OrderByClause,
  SelectColumn,
  SelectStatement,
  TableReference
} from "./ast.js";
import { ParserError } from "./parser-error.js";
import type { Token } from "../lexer/token.js";
import { TokenType } from "../lexer/token.js";

export class Parser {
  private readonly tokens: Token[];
  private current = 0;

  public constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  public parse(): SelectStatement {
    return this.parseSelectStatement();
  }

  public parseSelectStatement(): SelectStatement {
    this.consume(TokenType.Select, "Expected SELECT to start a select statement");

    const statement: SelectStatement = {
      type: "select",
      columns: this.parseSelectList(),
      from: this.parseFromClause()
    };

    if (this.match(TokenType.Where)) {
      statement.where = this.parseExpression();
    }

    if (this.match(TokenType.Order)) {
      statement.orderBy = this.parseOrderByClause();
    }

    if (this.match(TokenType.Limit)) {
      statement.limit = this.parseLimitValue();
    }

    if (this.match(TokenType.Semicolon) && this.check(TokenType.Semicolon)) {
      throw new ParserError("Only one trailing semicolon is allowed", this.peek());
    }

    this.consume(TokenType.Eof, "Unexpected token after complete SELECT statement");
    return statement;
  }

  private parseSelectList(): SelectColumn[] {
    if (this.match(TokenType.Star)) {
      return [{ type: "wildcard" }];
    }

    const columns: SelectColumn[] = [this.parseColumnReference("Expected column name in select list")];

    while (this.match(TokenType.Comma)) {
      columns.push(this.parseColumnReference("Expected column name after comma in select list"));
    }

    return columns;
  }

  private parseFromClause(): TableReference {
    this.consume(TokenType.From, "Expected FROM after select list");
    const table = this.consume(TokenType.Identifier, "Expected table name after FROM");

    return {
      type: "table",
      name: table.lexeme
    };
  }

  private parseExpression(): Expression {
    return this.parseOrExpression();
  }

  private parseOrExpression(): Expression {
    let expression = this.parseAndExpression();

    while (this.match(TokenType.Or)) {
      expression = this.logicalExpression("OR", expression, this.parseAndExpression());
    }

    return expression;
  }

  private parseAndExpression(): Expression {
    let expression = this.parseComparison();

    while (this.match(TokenType.And)) {
      expression = this.logicalExpression("AND", expression, this.parseComparison());
    }

    return expression;
  }

  private parseComparison(): Expression {
    if (this.match(TokenType.LeftParen)) {
      const expression = this.parseExpression();
      this.consume(TokenType.RightParen, "Expected closing parenthesis after expression");
      return expression;
    }

    const left = this.parseColumnReference("Expected column name in comparison");
    const operator = this.parseComparisonOperator();
    const right = this.parseLiteral("Expected comparison value");

    return {
      type: "comparison",
      operator,
      left,
      right
    };
  }

  private parseColumnReference(message: string): ColumnReference {
    const token = this.consume(TokenType.Identifier, message);

    return {
      type: "column",
      name: token.lexeme
    };
  }

  private parseComparisonOperator(): ComparisonOperator {
    if (this.match(TokenType.Equal)) {
      return "=";
    }

    if (this.match(TokenType.NotEqual)) {
      return "!=";
    }

    if (this.match(TokenType.Greater)) {
      return ">";
    }

    if (this.match(TokenType.GreaterEqual)) {
      return ">=";
    }

    if (this.match(TokenType.Less)) {
      return "<";
    }

    if (this.match(TokenType.LessEqual)) {
      return "<=";
    }

    throw new ParserError("Expected comparison operator", this.peek(), [
      TokenType.Equal,
      TokenType.NotEqual,
      TokenType.Greater,
      TokenType.GreaterEqual,
      TokenType.Less,
      TokenType.LessEqual
    ]);
  }

  private parseLiteral(message: string): LiteralExpression {
    if (this.match(TokenType.Integer, TokenType.Decimal, TokenType.String, TokenType.True, TokenType.False, TokenType.Null)) {
      const token = this.previous();
      return {
        type: "literal",
        value: "literal" in token ? token.literal : Number(token.lexeme)
      };
    }

    throw new ParserError(message, this.peek(), [
      TokenType.Integer,
      TokenType.Decimal,
      TokenType.String,
      TokenType.True,
      TokenType.False,
      TokenType.Null
    ]);
  }

  private parseOrderByClause(): OrderByClause {
    this.consume(TokenType.By, "Expected BY after ORDER");
    const column = this.consume(TokenType.Identifier, "Expected column name after ORDER BY");
    const direction = this.match(TokenType.Desc) ? "DESC" : "ASC";

    if (direction === "ASC") {
      this.match(TokenType.Asc);
    }

    return {
      column: column.lexeme,
      direction
    };
  }

  private parseLimitValue(): number {
    if (this.check(TokenType.Minus)) {
      throw new ParserError("LIMIT only accepts non-negative integers", this.peek(), [TokenType.Integer]);
    }

    if (this.check(TokenType.Decimal)) {
      throw new ParserError("LIMIT only accepts non-negative integers", this.peek(), [TokenType.Integer]);
    }

    const token = this.consume(TokenType.Integer, "Expected non-negative integer after LIMIT");
    const value = token.literal;

    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      throw new ParserError("LIMIT only accepts non-negative integers", token, [TokenType.Integer]);
    }

    return value;
  }

  private logicalExpression(operator: LogicalOperator, left: Expression, right: Expression): LogicalExpression {
    return {
      type: "logical",
      operator,
      left,
      right
    };
  }

  private match(...types: TokenType[]): boolean {
    if (!types.some((type) => this.check(type))) {
      return false;
    }

    this.advance();
    return true;
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) {
      return this.advance();
    }

    throw new ParserError(message, this.peek(), [type]);
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      this.current += 1;
    }

    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.Eof;
  }

  private peek(): Token {
    return this.tokens[this.current] ?? this.tokens[this.tokens.length - 1] ?? this.syntheticEof();
  }

  private previous(): Token {
    return this.tokens[this.current - 1] ?? this.syntheticEof();
  }

  private syntheticEof(): Token {
    return {
      type: TokenType.Eof,
      lexeme: "",
      start: 0,
      end: 0
    };
  }
}

export function parseSelectStatement(tokens: Token[]): SelectStatement {
  return new Parser(tokens).parseSelectStatement();
}
