import type { KansoErrorView, KansoExecutionResult, KansoScriptExecutionResult } from "../../features/execution/executionTypes";

export type ExecutionTraceStageId = "sql" | "lexer" | "parser" | "ast" | "executor" | "storage" | "results";
export type ExecutionTraceStageStatus = "complete" | "failed" | "skipped";

export interface ExecutionTrace {
  stages: ExecutionTraceStage[];
  tokens?: TokenTraceView[];
  ast?: AstTraceView;
  operators?: ExecutionOperatorView[];
  storageReads?: StorageReadView[];
  resultSummary?: ResultSummaryView;
}

export interface ExecutionTraceStage {
  id: ExecutionTraceStageId;
  status: ExecutionTraceStageStatus;
  durationMs?: number;
  summary?: string;
}

export type TokenTraceCategory = "keyword" | "identifier" | "literal" | "symbol" | "operator" | "eof";

export interface TokenTraceView {
  type: string;
  lexeme: string;
  literal?: string | number | boolean | null;
  start: number;
  end: number;
  category: TokenTraceCategory;
}

export interface AstTraceView {
  id: string;
  label: string;
  type: string;
  properties: AstTraceProperty[];
  children: AstTraceView[];
  truncated?: boolean;
}

export interface AstTraceProperty {
  key: string;
  value: string | number | boolean | null;
}

export type ExecutionOperatorKind =
  | "table_scan"
  | "filter"
  | "projection"
  | "join"
  | "aggregate"
  | "group"
  | "sort"
  | "limit"
  | "insert"
  | "update"
  | "delete"
  | "create_table"
  | "transaction"
  | "persistence"
  | "script";

export interface ExecutionOperatorView {
  id: string;
  kind: ExecutionOperatorKind;
  label: string;
  detail?: string;
  inputRows?: number;
  outputRows?: number;
  tableName?: string;
  children?: ExecutionOperatorView[];
}

export type StorageActivity =
  | "table_access"
  | "rows_changed"
  | "schema_changed"
  | "snapshot_created"
  | "snapshot_restored"
  | "file_saved";

export interface StorageReadView {
  id: string;
  activity: StorageActivity;
  tableName?: string;
  rowsInspected?: number;
  rowsMatched?: number;
  rowsChanged?: number;
  detail?: string;
}

export interface ResultSummaryView {
  resultType: KansoExecutionResult["type"] | KansoScriptExecutionResult["type"];
  rowCount?: number;
  affectedRows?: number;
  transactionState?: string;
  savePath?: string;
  bytesWritten?: number;
  script?: {
    succeeded: number;
    failed: number;
    skipped: number;
    atomic: boolean;
    committed: boolean;
    rolledBack: boolean;
  };
}

export interface KansoExecutionWithTrace {
  result: KansoExecutionResult;
  trace: ExecutionTrace;
}

export interface KansoScriptExecutionWithTrace {
  result: KansoScriptExecutionResult;
  trace: ExecutionTrace;
}

export interface KansoTracedError {
  error: KansoErrorView;
  trace: ExecutionTrace;
}

export const TRACE_STAGE_ORDER: readonly ExecutionTraceStageId[] = [
  "sql",
  "lexer",
  "parser",
  "ast",
  "executor",
  "storage",
  "results"
];
