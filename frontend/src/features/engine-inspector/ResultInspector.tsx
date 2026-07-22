import type { ResultSummaryView } from "../../engine/tracing/traceTypes";

interface ResultInspectorProps {
  summary: ResultSummaryView | undefined;
}

export function ResultInspector({ summary }: ResultInspectorProps) {
  if (summary === undefined) {
    return <p className="trace-note">No result summary is available yet.</p>;
  }

  return (
    <div className="result-inspector">
      <div className="trace-content-heading">
        <h3>Result Summary</h3>
        <span>{summary.resultType}</span>
      </div>
      <dl className="result-summary-grid">
        <Metric label="Type" value={summary.resultType} />
        {summary.rowCount === undefined ? null : <Metric label="Rows" value={summary.rowCount} />}
        {summary.affectedRows === undefined ? null : <Metric label="Affected" value={summary.affectedRows} />}
        {summary.transactionState === undefined ? null : <Metric label="Transaction" value={summary.transactionState} />}
        {summary.savePath === undefined ? null : <Metric label="Saved Path" value={summary.savePath} />}
        {summary.bytesWritten === undefined ? null : <Metric label="Bytes" value={summary.bytesWritten} />}
        {summary.script === undefined ? null : (
          <>
            <Metric label="Succeeded" value={summary.script.succeeded} />
            <Metric label="Failed" value={summary.script.failed} />
            <Metric label="Skipped" value={summary.script.skipped} />
            <Metric label="Atomic" value={summary.script.atomic ? "Yes" : "No"} />
            <Metric label="Committed" value={summary.script.committed ? "Yes" : "No"} />
            <Metric label="Rolled Back" value={summary.script.rolledBack ? "Yes" : "No"} />
          </>
        )}
      </dl>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
