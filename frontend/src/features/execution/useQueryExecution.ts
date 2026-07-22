import { useCallback, useRef, useState } from "react";
import type { KansoClient } from "../../engine/KansoClient";
import { mapKansoError } from "../../engine/errorMapper";
import { detectStatementMode } from "../../engine/statementMode";
import type { QueryTab } from "../editor/queryTabTypes";
import type { KansoRunResult, QueryTabExecutionSnapshot, SchemaRefreshReason } from "./executionTypes";

interface UseQueryExecutionOptions {
  client: KansoClient;
  onExecutionRecorded: (tab: QueryTab, snapshot: QueryTabExecutionSnapshot) => void;
  onSchemaRefreshNeeded: (reason: SchemaRefreshReason) => void;
  onSessionStateRefreshNeeded: () => void;
  onTabExecutionChange: (tabId: string, execution: QueryTabExecutionSnapshot | null) => void;
  scriptOptions: {
    atomic: boolean;
    stopOnError: boolean;
  };
}

interface UseQueryExecutionResult {
  cancelDisplay: () => void;
  executeTab: (tab: QueryTab) => Promise<void>;
  running: boolean;
  runningTabId: string | null;
}

export function useQueryExecution({
  client,
  onExecutionRecorded,
  onSchemaRefreshNeeded,
  onSessionStateRefreshNeeded,
  scriptOptions,
  onTabExecutionChange
}: UseQueryExecutionOptions): UseQueryExecutionResult {
  const [runningTabId, setRunningTabId] = useState<string | null>(null);
  const runIdRef = useRef(0);

  const cancelDisplay = useCallback(() => {
    runIdRef.current += 1;
    setRunningTabId(null);
  }, []);

  const executeTab = useCallback(async (tab: QueryTab) => {
    if (runningTabId !== null || tab.sql.trim().length === 0) {
      return;
    }

    const mode = detectStatementMode(tab.sql);
    if (mode === "empty") {
      return;
    }

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setRunningTabId(tab.id);

    try {
      const result = mode === "single"
        ? await client.executeWithTrace(tab.sql)
        : await client.executeScriptWithTrace(tab.sql, scriptOptions);

      if (runIdRef.current !== runId) {
        return;
      }

      const snapshot: QueryTabExecutionSnapshot = {
        status: "success",
        result: result.result,
        error: null,
        executionTimeMs: result.result.durationMs,
        executedSql: tab.sql,
        trace: result.trace
      };

      onTabExecutionChange(tab.id, snapshot);
      onExecutionRecorded(tab, snapshot);

      const reason = schemaRefreshReason(result.result);
      if (reason !== null) {
        onSchemaRefreshNeeded(reason);
      }
      onSessionStateRefreshNeeded();
    } catch (error) {
      if (runIdRef.current !== runId) {
        return;
      }

      const snapshot: QueryTabExecutionSnapshot = {
        status: "error",
        result: null,
        error: isTracedError(error) ? error.error : isKansoErrorView(error) ? error : mapKansoError(error),
        executionTimeMs: null,
        executedSql: tab.sql,
        trace: isTracedError(error) ? error.trace : null
      };

      onTabExecutionChange(tab.id, snapshot);
      onExecutionRecorded(tab, snapshot);
      onSessionStateRefreshNeeded();
    } finally {
      if (runIdRef.current === runId) {
        setRunningTabId(null);
      }
    }
  }, [client, onExecutionRecorded, onSchemaRefreshNeeded, onSessionStateRefreshNeeded, onTabExecutionChange, runningTabId, scriptOptions]);

  return {
    cancelDisplay,
    executeTab,
    running: runningTabId !== null,
    runningTabId
  };
}

function isTracedError(value: unknown): value is { error: NonNullable<QueryTabExecutionSnapshot["error"]>; trace: NonNullable<QueryTabExecutionSnapshot["trace"]> } {
  return typeof value === "object"
    && value !== null
    && "error" in value
    && isKansoErrorView(value.error)
    && "trace" in value
    && typeof value.trace === "object"
    && value.trace !== null;
}

function schemaRefreshReason(result: KansoRunResult): SchemaRefreshReason | null {
  if (result.type === "script") {
    return result.statements.some((statement) => statement.status === "success" && statement.result !== undefined && schemaRefreshReason(statement.result) !== null)
      ? "script"
      : null;
  }

  switch (result.type) {
    case "query":
      return null;
    case "schema":
      return "schema";
    case "mutation":
      return "mutation";
    case "transaction":
      return "transaction";
    case "persistence":
      return "persistence";
  }
}

function isKansoErrorView(value: unknown): value is NonNullable<QueryTabExecutionSnapshot["error"]> {
  return typeof value === "object"
    && value !== null
    && "code" in value
    && typeof value.code === "string"
    && "message" in value
    && typeof value.message === "string";
}
