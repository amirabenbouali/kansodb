import type {
  ColumnReference,
  ComparisonExpression,
  ComparisonOperator,
  CreateColumnDataType,
  CreateColumnDefinition,
  CreateTableStatement,
  Expression,
  InsertStatement,
  LiteralExpression,
  LogicalExpression,
  LogicalOperator,
  OrderByClause,
  SelectColumn,
  SelectStatement,
  Statement,
  TableReference
} from "./ast.js";
import { ParserError } from "../errors/parser-error.js";
import type { Token } from "../lexer/token.js";
import { TokenType } from "../lexer/token.js";

export class Parser {
  private readonly tokens: Token[];
  private current = 0;

  public constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  public parse(): Statement {
    if (this.check(TokenType.Select)) {
      return this.parseSelectStatement();
    }

    if (this.check(TokenType.Create)) {
      return this.parseCreateTableStatement();
    }

    if (this.check(TokenType.Insert)) {
      return this.parseInsertStatement();
    }

    throw new ParserError("Expected a supported SQL statement", this.peek(), [
      TokenType.Select,
      TokenType.Create,
      TokenType.Insert
    ]);
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

    this.finishStatement("Unexpected token after complete SELECT statement");
    return statement;
  }

  public parseCreateTableStatement(): CreateTableStatement {
    this.consume(TokenType.Create, "Expected CREATE to start a create table statement");
    this.consume(TokenType.Table, "Expected TABLE after CREATE");
    const tableName = this.consume(TokenType.Identifier, "Expected table name after CREATE TABLE");
    this.consume(TokenType.LeftParen, "Expected opening parenthesis before column definitions");

    if (this.check(TokenType.RightParen)) {
      throw new ParserError("Expected at least one column definition", this.peek(), [TokenType.Identifier]);
    }

    const columns = [this.parseCreateColumnDefinition()];

    while (this.match(TokenType.Comma)) {
      if (this.check(TokenType.RightParen)) {
        throw new ParserError("Expected column definition after comma", this.peek(), [TokenType.Identifier]);
      }

      columns.push(this.parseCreateColumnDefinition());
    }

    this.consume(TokenType.RightParen, "Expected closing parenthesis after column definitions");
    this.finishStatement("Unexpected token after complete CREATE TABLE statement");

    return {
      type: "create_table",
      tableName: tableName.lexeme,
      columns
    };
  }

  public parseInsertStatement(): InsertStatement {
    this.consume(TokenType.Insert, "Expected INSERT to start an insert statement");
    this.consume(TokenType.Into, "Expected INTO after INSERT");
    const tableName = this.consume(TokenType.Identifier, "Expected table name after INSERT INTO");
    const columns = this.check(TokenType.LeftParen) ? this.parseInsertColumns() : undefined;

    this.consume(TokenType.Values, "Expected VALUES in INSERT statement");
    this.consume(TokenType.LeftParen, "Expected opening parenthesis before VALUES list");

    if (this.check(TokenType.RightParen)) {
      throw new ParserError("Expected at least one value", this.peek(), [
        TokenType.Integer,
        TokenType.Decimal,
        TokenType.String,
        TokenType.True,
        TokenType.False,
        TokenType.Null
      ]);
    }

    const values = [this.parseLiteral("Expected value in VALUES list")];

    while (this.match(TokenType.Comma)) {
      if (this.check(TokenType.RightParen)) {
        throw new ParserError("Expected value after comma in VALUES list", this.peek(), [
          TokenType.Integer,
          TokenType.Decimal,
          TokenType.String,
          TokenType.True,
          TokenType.False,
          TokenType.Null
        ]);
      }

      values.push(this.parseLiteral("Expected value after comma in VALUES list"));
    }

    this.consume(TokenType.RightParen, "Expected closing parenthesis after VALUES list");
    this.finishStatement("Unexpected token after complete INSERT statement");

    const statement: InsertStatement = {
      type: "insert",
      tableName: tableName.lexeme,
      values
    };

    if (columns !== undefined) {
      statement.columns = columns;
    }

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

  private parseCreateColumnDefinition(): CreateColumnDefinition {
    const name = this.consume(TokenType.Identifier, "Expected column name in column definition");
    const dataType = this.parseDataType();
    const nullable = this.parseNullability();

    return {
      name: name.lexeme,
      dataType,
      nullable
    };
  }

  private parseDataType(): CreateColumnDataType {
    if (this.match(TokenType.IntegerType)) {
      return "INTEGER";
    }

    if (this.match(TokenType.DecimalType)) {
      return "DECIMAL";
    }

    if (this.match(TokenType.TextType)) {
      return "TEXT";
    }

    if (this.match(TokenType.BooleanType)) {
      return "BOOLEAN";
    }

    throw new ParserError("Expected column type", this.peek(), [
      TokenType.IntegerType,
      TokenType.DecimalType,
      TokenType.TextType,
      TokenType.BooleanType
    ]);
  }

  private parseNullability(): boolean {
    if (this.match(TokenType.Null)) {
      this.rejectAdditionalNullability();
      return true;
    }

    if (this.match(TokenType.Not)) {
      this.consume(TokenType.Null, "Expected NULL after NOT");
      this.rejectAdditionalNullability();
      return false;
    }

    return false;
  }

  private rejectAdditionalNullability(): void {
    if (this.check(TokenType.Null) || this.check(TokenType.Not)) {
      throw new ParserError("Conflicting nullability modifier", this.peek(), [TokenType.Comma, TokenType.RightParen]);
    }
  }

  private parseInsertColumns(): string[] {
    this.consume(TokenType.LeftParen, "Expected opening parenthesis before INSERT column list");

    if (this.check(TokenType.RightParen)) {
      throw new ParserError("Expected column name in INSERT column list", this.peek(), [TokenType.Identifier]);
    }

    const columns = [this.consume(TokenType.Identifier, "Expected column name in INSERT column list").lexeme];

    while (this.match(TokenType.Comma)) {
      if (this.check(TokenType.RightParen)) {
        throw new ParserError("Expected column name after comma in INSERT column list", this.peek(), [TokenType.Identifier]);
      }

      columns.push(this.consume(TokenType.Identifier, "Expected column name after comma in INSERT column list").lexeme);
    }

    this.consume(TokenType.RightParen, "Expected closing parenthesis after INSERT column list");
    return columns;
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

  private finishStatement(message: string): void {
    if (this.match(TokenType.Semicolon) && this.check(TokenType.Semicolon)) {
      throw new ParserError("Only one trailing semicolon is allowed", this.peek());
    }

    this.consume(TokenType.Eof, message);
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
