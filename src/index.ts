export { Lexer, tokenize } from "./lexer/lexer.js";
export { KEYWORDS, type Token, type TokenLiteral, TokenType } from "./lexer/token.js";
export { ExecutionError, type ExecutionErrorCode, type ExecutionErrorOptions } from "./errors/execution-error.js";
export { LexerError } from "./errors/lexer-error.js";
export { Parser, parseSelectStatement } from "./parser/parser.js";
export { ParserError } from "./errors/parser-error.js";
export { ScriptError, type ScriptErrorCode, type ScriptErrorOptions } from "./errors/script-error.js";
export { StorageError, type StorageErrorCode, type StorageErrorOptions } from "./errors/storage-error.js";
export { Executor, executeSql } from "./execution/executor.js";
export { AggregateExecutor } from "./execution/aggregate-executor.js";
export { JoinExecutor } from "./execution/join-executor.js";
export { analyseExpression, type AnalysedExpression, type ExpressionDataType } from "./execution/expression-analyser.js";
export {
  QueryScope,
  extendJoinedRow,
  joinedRowFromRelation,
  type JoinedRow,
  type QueryRelation,
  type ResolvedScopedColumn
} from "./execution/query-scope.js";
export { evaluateExpression } from "./execution/expression-evaluator.js";
export {
  compareDatabaseValues,
  evaluateBoolean,
  evaluatePredicate,
  evaluateScalar,
  evaluateScopedBoolean,
  evaluateScopedPredicate,
  evaluateScopedScalar,
  tableContext,
  type ScalarContext,
  type ScopedScalarContext
} from "./execution/expression-evaluator.js";
export { formatExpression } from "./execution/expression-formatter.js";
export { ProjectionExecutor, type ProjectionItem } from "./execution/projection-executor.js";
export { passesPredicate, sqlAnd, sqlNot, sqlOr, truthValueFromBoolean, type TruthValue } from "./execution/truth-value.js";
export { type QueryResult } from "./execution/query-result.js";
export { ExecutionHistory, type ScriptExecutionErrorRecord, type ScriptExecutionOptions, type ScriptExecutionResult, type StatementExecutionRecord } from "./execution/script-result.js";
export { ScriptExecutor, executeSqlScript } from "./execution/script-executor.js";
export { type CreateTableResult, type DeleteResult, type InsertResult, type StatementResult, type UpdateResult } from "./execution/statement-result.js";
export { ScriptParser, parseScript, type ParsedScriptStatement } from "./parser/script-parser.js";
export { type ColumnDefinition, type StoredColumnDefinition } from "./storage/column.js";
export { type PrimaryKeyMetadata, type UniqueConstraintMetadata } from "./storage/constraint.js";
export { Database } from "./storage/database.js";
export { DataType } from "./storage/data-type.js";
export { type ForeignKeyMetadata } from "./storage/foreign-key.js";
export { type DatabaseValue, type InputRow, type StoredRow } from "./storage/row.js";
export { Table } from "./storage/table.js";
export type {
  ColumnReference,
  ComparisonExpression,
  ComparisonOperator,
  ArithmeticExpression,
  ArithmeticOperator,
  AggregateExpression,
  AggregateFunctionName,
  CreateColumnDataType,
  CreateColumnDefinition,
  CreateTableStatement,
  DeleteStatement,
  Expression,
  ForeignKeyConstraint,
  ForeignKeyReference,
  InsertStatement,
  JoinClause,
  JoinCondition,
  JoinType,
  LiteralExpression,
  LogicalExpression,
  LogicalOperator,
  NullCheckExpression,
  NullsOrder,
  OrderByClause,
  OrderByExpression,
  OrderByItem,
  OrderDirection,
  OrdinalReference,
  ResultAliasReference,
  SelectColumn,
  SelectExpressionItem,
  SelectItem,
  SelectableExpression,
  SelectStatement,
  Statement,
  TableReference,
  TableConstraint,
  PrimaryKeyConstraint,
  UnaryExpression,
  UnaryOperator,
  UpdateAssignment,
  UpdateStatement,
  WildcardSelection
} from "./parser/ast.js";
