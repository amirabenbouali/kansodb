import { EmptyState } from "../../components/shared/EmptyState";
import { ExecutionError } from "./ExecutionError";
import type { KansoExecutionResult, KansoRunResult, QueryTabExecutionSnapshot } from "./executionTypes";
import { MutationResult } from "./MutationResult";
import { PersistenceResult } from "./PersistenceResult";
import { QueryResultTable } from "./QueryResultTable";
import { SchemaResult } from "./SchemaResult";
import { ScriptResult } from "./ScriptResult";
import { TransactionResult } from "./TransactionResult";

interface ExecutionPanelProps {
  running: boolean;
  snapshot: QueryTabExecutionSnapshot | null;
  transactionActive: boolean;
}

export function ExecutionPanel({ running, snapshot, transactionActive }: ExecutionPanelProps) {
  if (running) {
    return (
      <div className="execution-output">
        <div className="running-overlay" role="status">
          <span className="running-spinner" aria-hidden="true" />
          Running query against local KansoDB...
        </div>
        {snapshot?.result === undefined || snapshot.result === null ? null : renderResult(snapshot.result, transactionActive)}
      </div>
    );
  }

  if (snapshot === null || snapshot.status === "idle") {
    return <EmptyState message="Run SQL to see real KansoDB output here." />;
  }

  if (snapshot.status === "error" && snapshot.error !== null) {
    return <ExecutionError error={snapshot.error} sourceSql={snapshot.executedSql ?? undefined} />;
  }

  if (snapshot.result === null) {
    return <EmptyState message="No result is available for this tab yet." />;
  }

  return <div className="execution-output">{renderResult(snapshot.result, transactionActive)}</div>;
}

function renderResult(result: KansoRunResult, transactionActive: boolean) {
  if (result.type === "script") {
    return <ScriptResult result={result} />;
  }

  return renderStatementResult(result, transactionActive);
}

function renderStatementResult(result: KansoExecutionResult, transactionActive: boolean) {
  switch (result.type) {
    case "query":
      return <QueryResultTable result={result} />;
    case "mutation":
      return <MutationResult result={result} transactionActive={transactionActive} />;
    case "schema":
      return <SchemaResult result={result} transactionActive={transactionActive} />;
    case "transaction":
      return <TransactionResult result={result} />;
    case "persistence":
      return <PersistenceResult result={result} />;
  }
}
