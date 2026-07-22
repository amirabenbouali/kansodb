import type { ExecutionTrace } from "../../engine/tracing/traceTypes";
import type { KansoErrorView, KansoRunResult, QueryTabExecutionSnapshot } from "../execution/executionTypes";

export interface QueryHistoryEntry {
  id: string;
  tabId?: string;
  sql: string;
  executedAt: number;
  durationMs?: number;
  status: "success" | "error";
  resultType?: string;
  rowCount?: number;
  affectedRows?: number;
  error?: KansoErrorView;
  transactionState?: "IDLE" | "ACTIVE";
  scriptSummary?: {
    successCount: number;
    failureCount: number;
    skippedCount: number;
    committed: boolean;
    rolledBack: boolean;
  };
}

export interface QueryHistoryDetail {
  result: KansoRunResult | null;
  trace: ExecutionTrace | null;
  error: KansoErrorView | null;
  executedSql: string;
}

export interface QueryHistoryRecord {
  entry: QueryHistoryEntry;
  detail?: QueryHistoryDetail;
}

export type HistoryStatusFilter = "all" | "success" | "error";

export interface HistoryFiltersState {
  search: string;
  status: HistoryStatusFilter;
  resultType: string;
}

export function createHistoryEntry(tabId: string | undefined, sql: string, snapshot: QueryTabExecutionSnapshot): QueryHistoryEntry {
  const baseEntry = {
    id: createHistoryId(),
    ...(tabId === undefined ? {} : { tabId }),
    sql,
    executedAt: Date.now(),
    status: snapshot.status === "success" ? "success" as const : "error" as const,
    ...(snapshot.executionTimeMs === null ? {} : { durationMs: snapshot.executionTimeMs })
  };

  if (snapshot.result === null) {
    return {
      ...baseEntry,
      ...(snapshot.error === null ? {} : { error: sanitizeHistoryError(snapshot.error) })
    };
  }

  return {
    ...baseEntry,
    ...summarizeResult(snapshot.result)
  };
}

export function createHistoryDetail(snapshot: QueryTabExecutionSnapshot): QueryHistoryDetail {
  return {
    result: snapshot.result,
    trace: snapshot.trace,
    error: snapshot.error === null ? null : sanitizeHistoryError(snapshot.error),
    executedSql: snapshot.executedSql ?? ""
  };
}

export function sanitizeHistoryError(error: KansoErrorView): KansoErrorView {
  const safeMetadata = sanitizeMetadata(error.metadata);
  return {
    code: error.code,
    message: error.message,
    ...(safeMetadata === undefined ? {} : { metadata: safeMetadata })
  };
}

function summarizeResult(result: KansoRunResult): Omit<QueryHistoryEntry, "id" | "sql" | "executedAt" | "status"> {
  switch (result.type) {
    case "query":
      return {
        resultType: "query",
        rowCount: result.rowCount,
        durationMs: result.durationMs
      };
    case "mutation":
      return {
        resultType: result.operation,
        affectedRows: result.affectedRows,
        durationMs: result.durationMs
      };
    case "schema":
      return {
        resultType: "create_table",
        durationMs: result.durationMs
      };
    case "transaction":
      return {
        resultType: "transaction",
        transactionState: result.state === "ACTIVE" ? "ACTIVE" : "IDLE",
        durationMs: result.durationMs
      };
    case "persistence":
      return {
        resultType: "persistence",
        durationMs: result.durationMs
      };
    case "script":
      return {
        resultType: "script",
        durationMs: result.durationMs,
        scriptSummary: {
          successCount: result.succeeded,
          failureCount: result.failed,
          skippedCount: result.skipped,
          committed: result.committed,
          rolledBack: result.rolledBack
        }
      };
  }
}

function sanitizeMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (metadata === undefined) {
    return undefined;
  }

  const allowedKeys = [
    "tableName",
    "columnName",
    "referencedTableName",
    "referencedColumnName",
    "referencingTableName",
    "referencingColumnName",
    "value",
    "start",
    "end",
    "position",
    "unexpectedToken",
    "expected",
    "statementType",
    "currentState",
    "attemptedAction",
    "atomic"
  ];
  const safeMetadata: Record<string, unknown> = {};

  for (const key of allowedKeys) {
    const value = metadata[key];
    if (value !== undefined && isSafeMetadataValue(value)) {
      safeMetadata[key] = value;
    }
  }

  return Object.keys(safeMetadata).length === 0 ? undefined : safeMetadata;
}

function isSafeMetadataValue(value: unknown): boolean {
  return value === null
    || typeof value === "string"
    || typeof value === "number"
    || typeof value === "boolean"
    || (Array.isArray(value) && value.every((item) => typeof item === "string" || typeof item === "number"))
    || (typeof value === "object" && value !== null && Object.values(value).every((item) => item === null || typeof item === "string" || typeof item === "number" || typeof item === "boolean"));
}

function createHistoryId(): string {
  if (globalThis.crypto?.randomUUID !== undefined) {
    return globalThis.crypto.randomUUID();
  }

  return `history-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
