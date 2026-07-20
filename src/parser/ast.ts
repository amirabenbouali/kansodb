export type SelectColumn = ColumnReference | WildcardSelection;

export interface SelectStatement {
  type: "select";
  columns: SelectColumn[];
  from: TableReference;
  where?: Expression;
  orderBy?: OrderByClause;
  limit?: number;
}

export interface ColumnReference {
  type: "column";
  name: string;
}

export interface WildcardSelection {
  type: "wildcard";
}

export interface TableReference {
  type: "table";
  name: string;
}

export interface ComparisonExpression {
  type: "comparison";
  operator: ComparisonOperator;
  left: ColumnReference;
  right: LiteralExpression;
}

export interface LogicalExpression {
  type: "logical";
  operator: LogicalOperator;
  left: Expression;
  right: Expression;
}

export interface LiteralExpression {
  type: "literal";
  value: string | number | boolean | null;
}

export interface OrderByClause {
  column: string;
  direction: OrderDirection;
}

export type Expression = ComparisonExpression | LogicalExpression;
export type ComparisonOperator = "=" | "!=" | ">" | ">=" | "<" | "<=";
export type LogicalOperator = "AND" | "OR";
export type OrderDirection = "ASC" | "DESC";
