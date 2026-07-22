import type { KansoScriptExecutionResult } from "./executionTypes";
import { ExecutionError } from "./ExecutionError";

interface ScriptResultProps {
  result: KansoScriptExecutionResult;
}

export function ScriptResult({ result }: ScriptResultProps) {
  return (
    <div className="script-result">
      <div className="script-summary">
        <strong>{result.succeeded} succeeded</strong>
        <span>{result.failed} failed</span>
        <span>{result.skipped} skipped</span>
        <span>{result.atomic ? "Atomic" : "Non-atomic"}</span>
        <span>{result.committed ? "Committed" : result.rolledBack ? "Rolled back" : "No atomic commit"}</span>
        <span>{result.durationMs.toFixed(1)} ms</span>
      </div>
      <div className="script-records">
        {result.statements.map((record) => (
          <article className={`script-record is-${record.status}`} key={record.index}>
            <div>
              <strong>Statement {record.index + 1}</strong>
              <span>{record.status} · {record.resultType} · {record.durationMs.toFixed(1)} ms</span>
            </div>
            {record.sql.trim().length > 0 ? <code>{excerpt(record.sql)}</code> : null}
            {record.error === undefined ? null : <ExecutionError error={record.error} sourceSql={record.sql} />}
          </article>
        ))}
      </div>
    </div>
  );
}

function excerpt(sql: string): string {
  const normalized = sql.trim().replace(/\s+/g, " ");
  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
}
