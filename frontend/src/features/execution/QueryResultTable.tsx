import type { KansoCellValue, QueryExecutionView } from "./executionTypes";

interface QueryResultTableProps {
  result: QueryExecutionView;
}

const MAX_RENDERED_ROWS = 250;

export function QueryResultTable({ result }: QueryResultTableProps) {
  const renderedRows = result.rows.slice(0, MAX_RENDERED_ROWS);

  return (
    <div className="result-block">
      <div className="result-summary">
        <strong>{result.rowCount} rows</strong>
        <span>{formatDuration(result.durationMs)}</span>
      </div>
      <div className="result-table-shell">
        <table className="result-table">
          <thead>
            <tr>
              <th className="row-number-cell">#</th>
              {result.columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {renderedRows.length === 0 ? (
              <tr>
                <td className="empty-result-cell" colSpan={result.columns.length + 1}>No rows returned</td>
              </tr>
            ) : renderedRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className="row-number-cell">{rowIndex + 1}</td>
                {result.columns.map((column) => (
                  <td className={cellClassName(row[column])} key={column}>
                    {formatValue(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result.rows.length > MAX_RENDERED_ROWS ? (
        <p className="result-note">Showing first {MAX_RENDERED_ROWS} rows.</p>
      ) : null}
    </div>
  );
}

function cellClassName(value: KansoCellValue | undefined): string {
  if (typeof value === "number") {
    return "is-number";
  }

  if (typeof value === "boolean" || value === null || value === undefined) {
    return "is-literal";
  }

  return "is-text";
}

function formatValue(value: KansoCellValue | undefined): string {
  if (value === null || value === undefined) {
    return "NULL";
  }

  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  return String(value);
}

function formatDuration(durationMs: number): string {
  return `${durationMs.toFixed(1)} ms`;
}
