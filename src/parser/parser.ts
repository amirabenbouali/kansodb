import type {
  AggregateExpression,
  AggregateFunctionName,
  ArithmeticOperator,
  ColumnReference,
  ComparisonOperator,
  CreateColumnDataType,
  CreateColumnDefinition,
  CreateTableStatement,
  DeleteStatement,
  Expression,
  InsertStatement,
  JoinClause,
  JoinCondition,
  LiteralExpression,
  LogicalExpression,
  LogicalOperator,
  OrderByClause,
  OrderByExpression,
  OrderByItem,
  SelectColumn,
  SelectItem,
  SelectExpressionItem,
  SelectStatement,
  SelectableExpression,
  Statement,
  TableReference,
  TableConstraint,
  UpdateAssignment,
  UpdateStatement
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

    if (this.check(TokenType.Update)) {
      return this.parseUpdateStatement();
    }

    if (this.check(TokenType.Delete)) {
      return this.parseDeleteStatement();
    }

    throw new ParserError("Expected a supported SQL statement", this.peek(), [
      TokenType.Select,
      TokenType.Create,
      TokenType.Insert,
      TokenType.Update,
      TokenType.Delete
    ]);
  }

  public parseSelectStatement(): SelectStatement {
    this.consume(TokenType.Select, "Expected SELECT to start a select statement");

    const statement: SelectStatement = {
      type: "select",
      columns: this.parseSelectList(),
      from: this.parseFromClause()
    };

    const joins = this.parseJoinClauses();
    if (joins.length > 0) {
      statement.joins = joins;
    }

    if (this.match(TokenType.Where)) {
      statement.where = this.parseExpression();
    }

    if (this.match(TokenType.Group)) {
      statement.groupBy = this.parseGroupByClause();
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

    const firstElement = this.parseCreateTableElement();
    const columns: CreateColumnDefinition[] = [];
    const constraints: TableConstraint[] = [];
    this.collectCreateTableElement(firstElement, columns, constraints);

    while (this.match(TokenType.Comma)) {
      if (this.check(TokenType.RightParen)) {
        throw new ParserError("Expected column definition after comma", this.peek(), [TokenType.Identifier]);
      }

      this.collectCreateTableElement(this.parseCreateTableElement(), columns, constraints);
    }

    if (columns.length === 0) {
      throw new ParserError("Expected at least one column definition", this.peek(), [TokenType.Identifier]);
    }

    this.consume(TokenType.RightParen, "Expected closing parenthesis after column definitions");
    this.finishStatement("Unexpected token after complete CREATE TABLE statement");

    const statement: CreateTableStatement = {
      type: "create_table",
      tableName: tableName.lexeme,
      columns
    };

    if (constraints.length > 0) {
      statement.constraints = constraints;
    }

    return statement;
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

  public parseUpdateStatement(): UpdateStatement {
    this.consume(TokenType.Update, "Expected UPDATE to start an update statement");
    const tableName = this.consume(TokenType.Identifier, "Expected table name after UPDATE");
    this.consume(TokenType.Set, "Expected SET after table name in UPDATE statement");

    if (this.check(TokenType.Where) || this.check(TokenType.Semicolon) || this.check(TokenType.Eof)) {
      throw new ParserError("Expected assignment after SET", this.peek(), [TokenType.Identifier]);
    }

    const assignments = [this.parseAssignment()];

    while (this.match(TokenType.Comma)) {
      if (this.check(TokenType.Where) || this.check(TokenType.Semicolon) || this.check(TokenType.Eof)) {
        throw new ParserError("Expected assignment after comma", this.peek(), [TokenType.Identifier]);
      }

      assignments.push(this.parseAssignment());
    }

    const statement: UpdateStatement = {
      type: "update",
      tableName: tableName.lexeme,
      assignments
    };

    if (this.match(TokenType.Where)) {
      statement.where = this.parseExpression();
    }

    this.finishStatement("Unexpected token after complete UPDATE statement");
    return statement;
  }

  public parseDeleteStatement(): DeleteStatement {
    this.consume(TokenType.Delete, "Expected DELETE to start a delete statement");
    this.consume(TokenType.From, "Expected FROM after DELETE");
    const tableName = this.consume(TokenType.Identifier, "Expected table name after DELETE FROM");

    const statement: DeleteStatement = {
      type: "delete",
      tableName: tableName.lexeme
    };

    if (this.match(TokenType.Where)) {
      statement.where = this.parseExpression();
    }

    this.finishStatement("Unexpected token after complete DELETE statement");
    return statement;
  }

  private parseSelectList(): SelectItem[] {
    const columns: SelectItem[] = [this.parseSelectItem("Expected column name or aggregate expression in select list")];

    while (this.match(TokenType.Comma)) {
      columns.push(this.parseSelectItem("Expected column name after comma in select list"));
    }

    return columns;
  }

  private parseSelectItem(message: string): SelectItem {
    if (this.match(TokenType.Star)) {
      return { type: "wildcard" };
    }

    const expression = this.parseSelectableExpression(message);
    const item: SelectExpressionItem = {
      type: "select_expression",
      expression
    };

    if (this.match(TokenType.As)) {
      item.alias = this.consume(TokenType.Identifier, "Expected alias after AS").lexeme;
    }

    return item;
  }

  private parseSelectableExpression(message: string): SelectableExpression {
    const expression = this.parseAdditiveExpression(message);

    if (expression.type === "comparison" || expression.type === "logical" || expression.type === "null_check") {
      throw new ParserError("Expected scalar select expression", this.previous());
    }

    return expression;
  }

  private parseFromClause(): TableReference {
    this.consume(TokenType.From, "Expected FROM after select list");
    return this.parseTableReference("Expected table name after FROM");
  }

  private parseTableReference(message: string): TableReference {
    const table = this.consume(TokenType.Identifier, message);
    const reference: TableReference = {
      type: "table",
      name: table.lexeme
    };

    const alias = this.parseOptionalAlias();
    if (alias !== undefined) {
      reference.alias = alias;
    }

    return reference;
  }

  private parseOptionalAlias(): string | undefined {
    if (this.match(TokenType.As)) {
      return this.consume(TokenType.Identifier, "Expected alias after AS").lexeme;
    }

    if (this.check(TokenType.Identifier)) {
      return this.advance().lexeme;
    }

    return undefined;
  }

  private parseJoinClauses(): JoinClause[] {
    const joins: JoinClause[] = [];

    while (this.check(TokenType.Inner) || this.check(TokenType.Left) || this.check(TokenType.Join)) {
      joins.push(this.parseJoinClause());
    }

    return joins;
  }

  private parseJoinClause(): JoinClause {
    const joinType = this.match(TokenType.Left) ? "LEFT" : "INNER";
    if (joinType === "INNER") {
      this.match(TokenType.Inner);
    }
    this.consume(TokenType.Join, `Expected JOIN after ${joinType}`);
    const table = this.parseTableReference("Expected table name after JOIN");
    this.consume(TokenType.On, "Expected ON after JOIN table");
    const on = this.parseJoinCondition();

    return {
      type: "join",
      joinType,
      table,
      on
    };
  }

  private parseJoinCondition(): JoinCondition {
    const left = this.parseColumnReference("Expected left column in JOIN condition");
    this.consume(TokenType.Equal, "Expected equals sign in JOIN condition");
    const right = this.parseColumnReference("Expected right column in JOIN condition");

    return {
      type: "join_condition",
      left,
      operator: "=",
      right
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
    let expression = this.parseAdditiveExpression("Expected expression");

    if (!this.isComparisonOperator(this.peek().type)) {
      if (this.match(TokenType.Is)) {
        const negated = this.match(TokenType.Not);
        this.consume(TokenType.Null, negated ? "Expected NULL after IS NOT" : "Expected NULL after IS");
        return {
          type: "null_check",
          operand: expression,
          negated
        };
      }
      if (this.startsExpression(this.peek().type)) {
        throw new ParserError("Expected comparison operator", this.peek(), [
          TokenType.Equal,
          TokenType.NotEqual,
          TokenType.Greater,
          TokenType.GreaterEqual,
          TokenType.Less,
          TokenType.LessEqual
        ]);
      }
      return expression;
    }

    const operator = this.parseComparisonOperator();
    const right = this.parseAdditiveExpression("Expected comparison value");

    return {
      type: "comparison",
      operator,
      left: expression,
      right
    };
  }

  private parseAdditiveExpression(message: string): Expression {
    let expression = this.parseMultiplicativeExpression(message);

    while (this.match(TokenType.Plus, TokenType.Minus)) {
      const operator = this.previous().type === TokenType.Plus ? "+" : "-";
      expression = {
        type: "arithmetic",
        operator,
        left: expression,
        right: this.parseMultiplicativeExpression("Expected expression after arithmetic operator")
      };
    }

    return expression;
  }

  private parseMultiplicativeExpression(message: string): Expression {
    let expression = this.parseUnaryExpression(message);

    while (this.match(TokenType.Star, TokenType.Slash, TokenType.Percent)) {
      const operator = this.arithmeticOperatorFromToken(this.previous().type);
      expression = {
        type: "arithmetic",
        operator,
        left: expression,
        right: this.parseUnaryExpression("Expected expression after arithmetic operator")
      };
    }

    return expression;
  }

  private parseUnaryExpression(message: string): Expression {
    if (this.match(TokenType.Plus, TokenType.Minus)) {
      return {
        type: "unary",
        operator: this.previous().type === TokenType.Plus ? "+" : "-",
        operand: this.parseUnaryExpression("Expected expression after unary operator")
      };
    }

    return this.parsePrimaryExpression(message);
  }

  private parsePrimaryExpression(message: string): Expression {
    if (this.match(TokenType.LeftParen)) {
      if (this.check(TokenType.RightParen)) {
        throw new ParserError("Expected expression inside parentheses", this.peek(), [
          TokenType.Identifier,
          TokenType.Integer,
          TokenType.Decimal,
          TokenType.String,
          TokenType.True,
          TokenType.False,
          TokenType.Null,
          TokenType.LeftParen
        ]);
      }

      const expression = this.parseExpression();
      this.consume(TokenType.RightParen, "Expected closing parenthesis after expression");
      return expression;
    }

    if (this.isAggregateFunction(this.peek().type)) {
      return this.parseAggregateExpression();
    }

    if (this.check(TokenType.Identifier)) {
      return this.parseColumnReference(message);
    }

    if (this.check(TokenType.Integer) || this.check(TokenType.Decimal) || this.check(TokenType.String) || this.check(TokenType.True) || this.check(TokenType.False) || this.check(TokenType.Null)) {
      return this.parseLiteral(message);
    }

    throw new ParserError(message, this.peek(), [
      TokenType.Identifier,
      TokenType.Integer,
      TokenType.Decimal,
      TokenType.String,
      TokenType.True,
      TokenType.False,
      TokenType.Null,
      TokenType.LeftParen
    ]);
  }

  private parseColumnReference(message: string): ColumnReference {
    const token = this.consume(TokenType.Identifier, message);

    if (!this.match(TokenType.Dot)) {
      return {
        type: "column",
        name: token.lexeme
      };
    }

    const column = this.consume(TokenType.Identifier, "Expected identifier after dot in qualified column reference");

    return {
      type: "column",
      qualifier: token.lexeme,
      name: column.lexeme
    };
  }

  private parseAggregateExpression(): AggregateExpression {
    const functionName = this.parseAggregateFunction();
    this.consume(TokenType.LeftParen, "Expected opening parenthesis after aggregate function");

    if (this.check(TokenType.RightParen)) {
      throw new ParserError("Expected aggregate argument", this.peek(), [TokenType.Star, TokenType.Identifier]);
    }

    const argument = this.match(TokenType.Star)
      ? ({ type: "wildcard" } as const)
      : this.parseColumnReference("Expected aggregate argument");

    if (argument.type === "wildcard" && functionName !== "COUNT") {
      throw new ParserError(`${functionName}(*) is not supported`, this.previous(), [TokenType.Identifier]);
    }

    if (this.check(TokenType.Comma)) {
      throw new ParserError("Aggregate functions accept exactly one argument", this.peek(), [TokenType.RightParen]);
    }

    this.consume(TokenType.RightParen, "Expected closing parenthesis after aggregate argument");

    return {
      type: "aggregate",
      function: functionName,
      argument
    };
  }

  private parseAggregateFunction(): AggregateFunctionName {
    if (this.match(TokenType.Count)) {
      return "COUNT";
    }

    if (this.match(TokenType.Sum)) {
      return "SUM";
    }

    if (this.match(TokenType.Avg)) {
      return "AVG";
    }

    if (this.match(TokenType.Min)) {
      return "MIN";
    }

    if (this.match(TokenType.Max)) {
      return "MAX";
    }

    throw new ParserError("Expected aggregate function", this.peek(), [
      TokenType.Count,
      TokenType.Sum,
      TokenType.Avg,
      TokenType.Min,
      TokenType.Max
    ]);
  }

  private parseGroupByClause(): ColumnReference[] {
    this.consume(TokenType.By, "Expected BY after GROUP");

    if (this.check(TokenType.Order) || this.check(TokenType.Limit) || this.check(TokenType.Semicolon) || this.check(TokenType.Eof)) {
      throw new ParserError("Expected column name after GROUP BY", this.peek(), [TokenType.Identifier]);
    }

    const columns = [this.parseColumnReference("Expected column name after GROUP BY")];

    while (this.match(TokenType.Comma)) {
      if (this.check(TokenType.Order) || this.check(TokenType.Limit) || this.check(TokenType.Semicolon) || this.check(TokenType.Eof)) {
        throw new ParserError("Expected column name after comma in GROUP BY", this.peek(), [TokenType.Identifier]);
      }

      columns.push(this.parseColumnReference("Expected column name after comma in GROUP BY"));
    }

    return columns;
  }

  private isAggregateFunction(type: TokenType): boolean {
    return type === TokenType.Count || type === TokenType.Sum || type === TokenType.Avg || type === TokenType.Min || type === TokenType.Max;
  }

  private parseCreateTableElement(): CreateColumnDefinition | TableConstraint {
    if (this.check(TokenType.Constraint)) {
      throw new ParserError("Named constraints are not supported", this.peek(), [TokenType.Primary, TokenType.Foreign]);
    }

    if (this.check(TokenType.Primary) || this.check(TokenType.Foreign)) {
      return this.parseTableConstraint();
    }

    return this.parseCreateColumnDefinition();
  }

  private collectCreateTableElement(
    element: CreateColumnDefinition | TableConstraint,
    columns: CreateColumnDefinition[],
    constraints: TableConstraint[]
  ): void {
    if ("dataType" in element) {
      columns.push(element);
    } else {
      constraints.push(element);
    }
  }

  private parseTableConstraint(): TableConstraint {
    if (this.match(TokenType.Primary)) {
      this.consume(TokenType.Key, "Expected KEY after PRIMARY");
      this.consume(TokenType.LeftParen, "Expected opening parenthesis after PRIMARY KEY");
      const columnName = this.consume(TokenType.Identifier, "Expected primary key column name").lexeme;
      if (this.match(TokenType.Comma)) {
        throw new ParserError("Composite primary keys are not supported", this.previous(), [TokenType.RightParen]);
      }
      this.consume(TokenType.RightParen, "Expected closing parenthesis after PRIMARY KEY column");
      return { type: "primary_key", columnName };
    }

    this.consume(TokenType.Foreign, "Expected table constraint");
    this.consume(TokenType.Key, "Expected KEY after FOREIGN");
    this.consume(TokenType.LeftParen, "Expected opening parenthesis after FOREIGN KEY");
    const columnName = this.consume(TokenType.Identifier, "Expected foreign key column name").lexeme;
    if (this.match(TokenType.Comma)) {
      throw new ParserError("Composite foreign keys are not supported", this.previous(), [TokenType.RightParen]);
    }
    this.consume(TokenType.RightParen, "Expected closing parenthesis after FOREIGN KEY column");
    this.consume(TokenType.References, "Expected REFERENCES after FOREIGN KEY column");
    return {
      type: "foreign_key",
      columnName,
      references: this.parseForeignKeyReference()
    };
  }

  private parseCreateColumnDefinition(): CreateColumnDefinition {
    const name = this.consume(TokenType.Identifier, "Expected column name in column definition");
    const dataType = this.parseDataType();
    const constraints = this.parseColumnConstraints();

    return {
      name: name.lexeme,
      dataType,
      nullable: constraints.primaryKey ? false : constraints.nullable,
      unique: constraints.primaryKey ? true : constraints.unique,
      primaryKey: constraints.primaryKey,
      ...(constraints.references === undefined ? {} : { references: constraints.references })
    };
  }

  private parseColumnConstraints(): { nullable: boolean; unique: boolean; primaryKey: boolean; references?: { tableName: string; columnName: string } } {
    let nullable = false;
    let sawNullability = false;
    let unique = false;
    let primaryKey = false;
    let references: { tableName: string; columnName: string } | undefined;

    while (true) {
      if (this.match(TokenType.Primary)) {
        if (primaryKey) throw new ParserError("Duplicate PRIMARY KEY constraint", this.previous());
        this.consume(TokenType.Key, "Expected KEY after PRIMARY");
        primaryKey = true;
        continue;
      }

      if (this.match(TokenType.Unique)) {
        if (unique) throw new ParserError("Duplicate UNIQUE constraint", this.previous());
        unique = true;
        continue;
      }

      if (this.match(TokenType.Not)) {
        if (sawNullability) throw new ParserError("Conflicting nullability modifier", this.previous());
        this.consume(TokenType.Null, "Expected NULL after NOT");
        nullable = false;
        sawNullability = true;
        continue;
      }

      if (this.match(TokenType.Null)) {
        if (sawNullability || primaryKey) throw new ParserError("Conflicting nullability modifier", this.previous());
        nullable = true;
        sawNullability = true;
        continue;
      }

      if (this.match(TokenType.References)) {
        if (references !== undefined) throw new ParserError("Duplicate REFERENCES constraint", this.previous());
        references = this.parseForeignKeyReference();
        continue;
      }

      break;
    }

    if (primaryKey && nullable) {
      throw new ParserError("PRIMARY KEY cannot be nullable", this.previous());
    }

    return references === undefined ? { nullable, unique, primaryKey } : { nullable, unique, primaryKey, references };
  }

  private parseForeignKeyReference(): { tableName: string; columnName: string } {
    const tableName = this.consume(TokenType.Identifier, "Expected referenced table name after REFERENCES").lexeme;
    this.consume(TokenType.LeftParen, "Expected opening parenthesis before referenced column");
    const columnName = this.consume(TokenType.Identifier, "Expected referenced column name").lexeme;
    if (this.match(TokenType.Comma)) {
      throw new ParserError("Composite referenced keys are not supported", this.previous(), [TokenType.RightParen]);
    }
    this.consume(TokenType.RightParen, "Expected closing parenthesis after referenced column");
    return { tableName, columnName };
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

  private parseAssignment(): UpdateAssignment {
    const column = this.consume(TokenType.Identifier, "Expected assignment column name");
    this.consume(TokenType.Equal, "Expected equals sign in assignment");

    return {
      columnName: column.lexeme,
      value: this.parseExpression()
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
    const items = [this.parseOrderByItem()];

    while (this.match(TokenType.Comma)) {
      if (this.check(TokenType.Limit) || this.check(TokenType.Semicolon) || this.check(TokenType.Eof)) {
        throw new ParserError("Expected order item after comma", this.peek(), [TokenType.Identifier, TokenType.Integer]);
      }

      items.push(this.parseOrderByItem());
    }

    return { items };
  }

  private parseOrderByItem(): OrderByItem {
    if (this.check(TokenType.Limit) || this.check(TokenType.Semicolon) || this.check(TokenType.Eof)) {
      throw new ParserError("Expected order item after ORDER BY", this.peek(), [TokenType.Identifier, TokenType.Integer]);
    }

    const expression = this.parseOrderByExpression();
    const direction = this.match(TokenType.Desc) ? "DESC" : "ASC";

    if (direction === "ASC") {
      this.match(TokenType.Asc);
    }

    const item: OrderByItem = {
      expression,
      direction
    };

    if (this.match(TokenType.Nulls)) {
      if (this.match(TokenType.First)) {
        item.nulls = "FIRST";
      } else if (this.match(TokenType.Last)) {
        item.nulls = "LAST";
      } else {
        throw new ParserError("NULLS must be followed by FIRST or LAST", this.peek(), [TokenType.First, TokenType.Last]);
      }
    }

    return item;
  }

  private parseOrderByExpression(): OrderByExpression {
    if (this.check(TokenType.Integer)) {
      const token = this.advance();
      if (typeof token.literal !== "number" || token.literal <= 0) {
        throw new ParserError("ORDER BY position must be a positive integer", token, [TokenType.Integer]);
      }
      return { type: "ordinal", position: token.literal };
    }

    if (this.check(TokenType.Minus)) {
      throw new ParserError("ORDER BY position must be a positive integer", this.peek(), [TokenType.Integer]);
    }

    if (this.isAggregateFunction(this.peek().type)) {
      return this.parseAggregateExpression();
    }

    if (this.check(TokenType.Identifier)) {
      const token = this.advance();
      if (this.match(TokenType.Dot)) {
        const column = this.consume(TokenType.Identifier, "Expected identifier after dot in qualified ORDER BY column");
        return { type: "column", qualifier: token.lexeme, name: column.lexeme };
      }
      return { type: "result_alias", name: token.lexeme };
    }

    throw new ParserError("Expected column name after ORDER BY", this.peek(), [
      TokenType.Identifier,
      TokenType.Count,
      TokenType.Sum,
      TokenType.Avg,
      TokenType.Min,
      TokenType.Max
    ]);
  }

  private isComparisonOperator(type: TokenType): boolean {
    return type === TokenType.Equal
      || type === TokenType.NotEqual
      || type === TokenType.Greater
      || type === TokenType.GreaterEqual
      || type === TokenType.Less
      || type === TokenType.LessEqual;
  }

  private startsExpression(type: TokenType): boolean {
    return type === TokenType.Identifier
      || type === TokenType.Integer
      || type === TokenType.Decimal
      || type === TokenType.String
      || type === TokenType.True
      || type === TokenType.False
      || type === TokenType.Null
      || type === TokenType.LeftParen
      || type === TokenType.Plus
      || type === TokenType.Minus
      || this.isAggregateFunction(type);
  }

  private arithmeticOperatorFromToken(type: TokenType): ArithmeticOperator {
    switch (type) {
      case TokenType.Star:
        return "*";
      case TokenType.Slash:
        return "/";
      case TokenType.Percent:
        return "%";
      case TokenType.Plus:
        return "+";
      case TokenType.Minus:
        return "-";
      default:
        throw new ParserError("Expected arithmetic operator", this.previous());
    }
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
