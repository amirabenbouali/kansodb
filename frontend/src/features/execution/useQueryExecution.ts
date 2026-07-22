import { useCallback, useRef, useState } from "react";
import type { KansoClient } from "../../engine/KansoClient";
import { mapKansoError } from "../../engine/errorMapper";
import { detectStatementMode } from "../../engine/statementMode";
import type { QueryTab } from "../editor/queryTabTypes";
import type { KansoRunResult, QueryTabExecutionSnapshot, SchemaRefreshReason } from "./executionTypes";

interface UseQueryExecutionOptions {
  client: KansoClient;
  onSchemaRefreshNeeded: (reason: SchemaRefreshReason) => void;
  onTabExecutionChange: (tabId: string, execution: QueryTabExecutionSnapshot | null) => void;
}

interface UseQueryExecutionResult {
  cancelDisplay: () => void;
  executeTab: (tab: QueryTab) => Promise<void>;
  running: boolean;
  runningTabId: string | null;
}

export function useQueryExecution({
  client,
  onSchemaRefreshNeeded,
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
        ? await client.execute(tab.sql)
        : await client.executeScript(tab.sql, { stopOnError: true, atomic: false });

      if (runIdRef.current !== runId) {
        return;
      }

      const snapshot: QueryTabExecutionSnapshot = {
        status: "success",
        result,
        error: null,
        executionTimeMs: result.durationMs,
        executedSql: tab.sql
      };

      onTabExecutionChange(tab.id, snapshot);

      const reason = schemaRefreshReason(result);
      if (reason !== null) {
        onSchemaRefreshNeeded(reason);
      }
    } catch (error) {
      if (runIdRef.current !== runId) {
        return;
      }

      onTabExecutionChange(tab.id, {
        status: "error",
        result: null,
        error: isKansoErrorView(error) ? error : mapKansoError(error),
        executionTimeMs: null,
        executedSql: tab.sql
      });
    } finally {
      if (runIdRef.current === runId) {
        setRunningTabId(null);
      }
    }
  }, [client, onSchemaRefreshNeeded, onTabExecutionChange, runningTabId]);

  return {
    cancelDisplay,
    executeTab,
    running: runningTabId !== null,
    runningTabId
  };
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
