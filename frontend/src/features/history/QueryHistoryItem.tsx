import { CheckCircle2, Clipboard, ExternalLink, Eye, FileInput, Trash2, XCircle } from "lucide-react";
import type { QueryHistoryEntry } from "./historyTypes";

interface QueryHistoryItemProps {
  compact?: boolean;
  entry: QueryHistoryEntry;
  onCopySql: (sql: string) => void;
  onInspect: (entryId: string) => void;
  onRemove: (entryId: string) => void;
  onReopen: (sql: string) => void;
  onReplace: (sql: string) => void;
}

export function QueryHistoryItem({
  compact = false,
  entry,
  onCopySql,
  onInspect,
  onRemove,
  onReopen,
  onReplace
}: QueryHistoryItemProps) {
  return (
    <article className={compact ? `history-card is-${entry.status}` : `history-entry is-${entry.status}`}>
      <span className="history-status" aria-hidden="true">
        {entry.status === "success" ? <CheckCircle2 size={16} strokeWidth={2} /> : <XCircle size={16} strokeWidth={2} />}
      </span>
      <div className="history-entry-main">
        <code>{previewSql(entry.sql)}</code>
        <span>{historySummary(entry)} · {formatTimestamp(entry.executedAt)}{entry.durationMs === undefined ? "" : ` · ${entry.durationMs.toFixed(1)} ms`}</span>
      </div>
      {compact ? <strong className="history-outcome">{shortOutcome(entry)}</strong> : (
        <div className="history-entry-actions">
          <button type="button" aria-label="Inspect history entry" title="Inspect" onClick={() => onInspect(entry.id)}>
            <Eye size={14} aria-hidden="true" />
          </button>
          <button type="button" aria-label="Reopen SQL in a new tab" title="Reopen" onClick={() => onReopen(entry.sql)}>
            <ExternalLink size={14} aria-hidden="true" />
          </button>
          <button type="button" aria-label="Replace current editor SQL" title="Replace current" onClick={() => onReplace(entry.sql)}>
            <FileInput size={14} aria-hidden="true" />
          </button>
          <button type="button" aria-label="Copy SQL" title="Copy SQL" onClick={() => onCopySql(entry.sql)}>
            <Clipboard size={14} aria-hidden="true" />
          </button>
          <button type="button" aria-label="Remove history entry" title="Remove" onClick={() => onRemove(entry.id)}>
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      )}
    </article>
  );
}

export function historySummary(entry: QueryHistoryEntry): string {
  if (entry.status === "error") {
    return entry.error?.code ?? "Error";
  }

  if (entry.scriptSummary !== undefined) {
    return `${entry.scriptSummary.successCount} ok, ${entry.scriptSummary.failureCount} failed`;
  }

  if (entry.rowCount !== undefined) {
    return `${entry.rowCount} ${entry.rowCount === 1 ? "row" : "rows"}`;
  }

  if (entry.affectedRows !== undefined) {
    return `${entry.affectedRows} affected`;
  }

  if (entry.transactionState !== undefined) {
    return `Transaction ${entry.transactionState}`;
  }

  return entry.resultType ?? "Success";
}

function shortOutcome(entry: QueryHistoryEntry): string {
  if (entry.status === "error") {
    return "Error";
  }

  return entry.rowCount !== undefined ? `${entry.rowCount} rows` : entry.affectedRows !== undefined ? `${entry.affectedRows} rows` : entry.resultType ?? "Done";
}

function previewSql(sql: string): string {
  const normalized = sql.trim().replace(/\s+/g, " ");
  return normalized.length > 90 ? `${normalized.slice(0, 87)}...` : normalized;
}

function formatTimestamp(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(value);
}
