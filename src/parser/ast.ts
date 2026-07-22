export type SelectableExpression =
  | ColumnReference
  | LiteralExpression
  | UnaryExpression
  | ArithmeticExpression
  | AggregateExpression;
export type SelectColumn = SelectableExpression | WildcardSelection;
export type SelectItem = WildcardSelection | SelectExpressionItem;
export type Statement =
  | SelectStatement
  | CreateTableStatement
  | InsertStatement
  | UpdateStatement
  | DeleteStatement
  | BeginTransactionStatement
  | CommitTransactionStatement
  | RollbackTransactionStatement;

export interface SelectStatement {
  type: "select";
  columns: SelectItem[];
  from: TableReference;
  joins?: JoinClause[];
  where?: Expression;
  groupBy?: ColumnReference[];
  orderBy?: OrderByClause;
  limit?: number;
}

export interface CreateTableStatement {
  type: "create_table";
  tableName: string;
  columns: CreateColumnDefinition[];
  constraints?: TableConstraint[];
}

export interface CreateColumnDefinition {
  name: string;
  dataType: CreateColumnDataType;
  nullable: boolean;
  unique: boolean;
  primaryKey: boolean;
  references?: ForeignKeyReference;
}

export interface ForeignKeyReference {
  tableName: string;
  columnName: string;
}

export type TableConstraint = PrimaryKeyConstraint | ForeignKeyConstraint;

export interface PrimaryKeyConstraint {
  type: "primary_key";
  columnName: string;
}

export interface ForeignKeyConstraint {
  type: "foreign_key";
  columnName: string;
  references: ForeignKeyReference;
}

export interface InsertStatement {
  type: "insert";
  tableName: string;
  columns?: string[];
  values: LiteralExpression[];
}

export interface UpdateStatement {
  type: "update";
  tableName: string;
  assignments: UpdateAssignment[];
  where?: Expression;
}

export interface UpdateAssignment {
  columnName: string;
  value: Expression;
}

export interface DeleteStatement {
  type: "delete";
  tableName: string;
  where?: Expression;
}

export interface BeginTransactionStatement {
  type: "begin_transaction";
}

export interface CommitTransactionStatement {
  type: "commit_transaction";
}

export interface RollbackTransactionStatement {
  type: "rollback_transaction";
}

export interface AggregateExpression {
  type: "aggregate";
  function: AggregateFunctionName;
  argument: WildcardSelection | ColumnReference;
}

export interface ColumnReference {
  type: "column";
  name: string;
  qualifier?: string;
}

export interface WildcardSelection {
  type: "wildcard";
}

export interface SelectExpressionItem {
  type: "select_expression";
  expression: SelectableExpression;
  alias?: string;
}

export interface TableReference {
  type: "table";
  name: string;
  alias?: string;
}

export interface ComparisonExpression {
  type: "comparison";
  operator: ComparisonOperator;
  left: Expression;
  right: Expression;
}

export interface LogicalExpression {
  type: "logical";
  operator: LogicalOperator;
  left: Expression;
  right: Expression;
}

export interface NullCheckExpression {
  type: "null_check";
  operand: Expression;
  negated: boolean;
}

export interface LiteralExpression {
  type: "literal";
  value: string | number | boolean | null;
}

export interface UnaryExpression {
  type: "unary";
  operator: UnaryOperator;
  operand: Expression;
}

export interface ArithmeticExpression {
  type: "arithmetic";
  operator: ArithmeticOperator;
  left: Expression;
  right: Expression;
}

export interface OrderByClause {
  items: OrderByItem[];
}

export interface OrderByItem {
  expression: OrderByExpression;
  direction: OrderDirection;
  nulls?: NullsOrder;
}

export type OrderByExpression =
  | ColumnReference
  | AggregateExpression
  | ResultAliasReference
  | OrdinalReference;

export interface ResultAliasReference {
  type: "result_alias";
  name: string;
}

export interface OrdinalReference {
  type: "ordinal";
  position: number;
}

export type Expression =
  | LiteralExpression
  | ColumnReference
  | UnaryExpression
  | ArithmeticExpression
  | ComparisonExpression
  | LogicalExpression
  | NullCheckExpression
  | AggregateExpression;
export type ComparisonOperator = "=" | "!=" | ">" | ">=" | "<" | "<=";
export type LogicalOperator = "AND" | "OR";
export type UnaryOperator = "+" | "-";
export type ArithmeticOperator = "+" | "-" | "*" | "/" | "%";
export type OrderDirection = "ASC" | "DESC";
export type NullsOrder = "FIRST" | "LAST";
export type CreateColumnDataType = "INTEGER" | "DECIMAL" | "TEXT" | "BOOLEAN";
export type AggregateFunctionName = "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";
export type JoinType = "INNER" | "LEFT";

export interface JoinClause {
  type: "join";
  joinType: JoinType;
  table: TableReference;
  on: JoinCondition;
}

export interface JoinCondition {
  type: "join_condition";
  left: ColumnReference;
  operator: "=";
  right: ColumnReference;
}
