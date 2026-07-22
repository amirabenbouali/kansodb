export { Lexer, tokenize } from "./lexer/lexer.js";
export { KEYWORDS, type Token, type TokenLiteral, TokenType } from "./lexer/token.js";
export { ExecutionError, type ExecutionErrorCode, type ExecutionErrorOptions } from "./errors/execution-error.js";
export { demoQueries, demoWorkspaceDatabaseName, demoWorkspaceDescription, demoWorkspaceName, demoWorkspaceSql, type DemoQuery } from "./examples/demo-workspace.js";
export { LexerError } from "./errors/lexer-error.js";
export { Parser, parseSelectStatement } from "./parser/parser.js";
export { ParserError } from "./errors/parser-error.js";
export { PersistenceError, type PersistenceErrorCode, type PersistenceErrorOptions } from "./errors/persistence-error.js";
export { ScriptError, type ScriptErrorCode, type ScriptErrorOptions } from "./errors/script-error.js";
export { StorageError, type StorageErrorCode, type StorageErrorOptions } from "./errors/storage-error.js";
export { TransactionError, type TransactionErrorCode, type TransactionErrorOptions } from "./errors/transaction-error.js";
export { Executor, executeSql, executeSqlAsync } from "./execution/executor.js";
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
export { ScriptExecutor, executeSqlScript, executeSqlScriptAsync } from "./execution/script-executor.js";
export { type CreateTableResult, type DeleteResult, type InsertResult, type PersistenceResult, type StatementResult, type TransactionResult, type UpdateResult } from "./execution/statement-result.js";
export { TransactionExecutor, type TransactionStatement } from "./execution/transaction-executor.js";
export { DatabaseCodec, type DatabaseEncodeOptions } from "./persistence/database-codec.js";
export { type FileAdapter } from "./persistence/file-adapter.js";
export { NodeFileAdapter } from "./persistence/node-file-adapter.js";
export { PersistenceManager, type SaveResult } from "./persistence/persistence-manager.js";
export {
  CURRENT_STORAGE_FORMAT_VERSION,
  STORAGE_FORMAT_NAME,
  type PersistedColumn,
  type PersistedDatabase,
  type PersistedDatabaseFile,
  type PersistedForeignKey,
  type PersistedPrimaryKey,
  type PersistedRow,
  type PersistedTable,
  type PersistedUniqueConstraint
} from "./persistence/storage-format.js";
export { ScriptParser, parseScript, type ParsedScriptStatement } from "./parser/script-parser.js";
export { type ColumnDefinition, type StoredColumnDefinition } from "./storage/column.js";
export { type PrimaryKeyMetadata, type UniqueConstraintMetadata } from "./storage/constraint.js";
export { Database, type AutoSaveMode, type DatabaseOpenOptions, type PersistenceState } from "./storage/database.js";
export { DataType } from "./storage/data-type.js";
export { type ForeignKeyMetadata } from "./storage/foreign-key.js";
export { type DatabaseValue, type InputRow, type StoredRow } from "./storage/row.js";
export { Table } from "./storage/table.js";
export {
  cloneDatabaseSnapshot,
  freezeDatabaseSnapshot,
  type DatabaseSnapshot,
  type TableSnapshot,
  type TransactionAction,
  type TransactionSnapshot,
  type TransactionState
} from "./storage/transaction.js";
export { TransactionManager } from "./storage/transaction-manager.js";
export type {
  BeginTransactionStatement,
  ColumnReference,
  CommitTransactionStatement,
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
  RollbackTransactionStatement,
  SaveDatabaseStatement,
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
