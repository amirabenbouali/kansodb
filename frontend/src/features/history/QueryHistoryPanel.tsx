import { Trash2 } from "lucide-react";
import type { QueryHistoryEntry } from "./historyTypes";
import { QueryHistoryItem } from "./QueryHistoryItem";

interface QueryHistoryPanelProps {
  entries: readonly QueryHistoryEntry[];
  onClearHistory: () => void;
  onCopySql: (sql: string) => void;
  onInspectHistory: () => void;
  onRemoveEntry: (entryId: string) => void;
  onReopenSql: (sql: string) => void;
  onReplaceSql: (sql: string) => void;
}

export function QueryHistoryPanel({
  entries,
  onClearHistory,
  onCopySql,
  onInspectHistory,
  onRemoveEntry,
  onReopenSql,
  onReplaceSql
}: QueryHistoryPanelProps) {
  const visibleEntries = entries.slice(0, 5);

  return (
    <section className="right-section">
      <div className="right-section-heading">
        <h2>Query History</h2>
        <div>
          <button type="button" onClick={onInspectHistory}>View all</button>
          <button type="button" aria-label="Clear query history" onClick={onClearHistory}>
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
      {visibleEntries.length === 0 ? (
        <p className="history-empty">Executed queries will appear here.</p>
      ) : (
        <div className="history-stack">
          {visibleEntries.map((entry) => (
            <QueryHistoryItem
              compact
              key={entry.id}
              entry={entry}
              onCopySql={onCopySql}
              onInspect={() => onInspectHistory()}
              onRemove={onRemoveEntry}
              onReopen={onReopenSql}
              onReplace={onReplaceSql}
            />
          ))}
        </div>
      )}
    </section>
  );
}
