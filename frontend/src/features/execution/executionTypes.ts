import type { DatabaseSchemaView } from "../schema/schemaTypes";

export type KansoCellValue = string | number | boolean | null;
export type KansoResultRow = Record<string, KansoCellValue>;

export interface KansoErrorView {
  code: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface QueryExecutionView {
  type: "query";
  columns: string[];
  rows: KansoResultRow[];
  rowCount: number;
  durationMs: number;
}

export interface MutationExecutionView {
  type: "mutation";
  operation: "insert" | "update" | "delete";
  tableName: string;
  affectedRows: number;
  durationMs: number;
}

export interface SchemaExecutionView {
  type: "schema";
  operation: "create_table";
  tableName: string;
  columnCount: number;
  constraints: {
    primaryKeys: number;
    unique: number;
    foreignKeys: number;
    nullable: number;
  };
  durationMs: number;
}

export interface TransactionExecutionView {
  type: "transaction";
  action: "BEGIN" | "COMMIT" | "ROLLBACK";
  state: string;
  durationMs: number;
}

export interface PersistenceExecutionView {
  type: "persistence";
  action: "SAVE";
  path: string;
  bytesWritten: number;
  durationMs: number;
}

export type KansoExecutionResult =
  | QueryExecutionView
  | MutationExecutionView
  | SchemaExecutionView
  | TransactionExecutionView
  | PersistenceExecutionView;

export interface KansoScriptStatementView {
  index: number;
  sql: string;
  status: "success" | "error" | "skipped";
  resultType: KansoExecutionResult["type"] | "none";
  result?: KansoExecutionResult;
  error?: KansoErrorView;
  durationMs: number;
}

export interface KansoScriptExecutionResult {
  type: "script";
  statements: KansoScriptStatementView[];
  statementCount: number;
  succeeded: number;
  failed: number;
  skipped: number;
  completed: boolean;
  atomic: boolean;
  committed: boolean;
  rolledBack: boolean;
  durationMs: number;
}

export type KansoRunResult = KansoExecutionResult | KansoScriptExecutionResult;

export type QueryExecutionStatus = "idle" | "running" | "success" | "error";

export interface QueryTabExecutionSnapshot {
  status: Exclude<QueryExecutionStatus, "running">;
  result: KansoRunResult | null;
  error: KansoErrorView | null;
  executionTimeMs: number | null;
  executedSql: string | null;
}

export type SchemaRefreshReason = "schema" | "mutation" | "transaction" | "persistence" | "script";

export interface KansoSchemaProvider {
  getSchema(): Promise<DatabaseSchemaView>;
}
