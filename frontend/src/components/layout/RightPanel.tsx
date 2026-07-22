import { Moon } from "lucide-react";
import type { KansoSessionState } from "../../engine/KansoClient";
import { QueryHistoryPanel } from "../../features/history/QueryHistoryPanel";
import type { QueryHistoryEntry } from "../../features/history/historyTypes";
import { SchemaExplorer } from "../../features/schema/SchemaExplorer";
import type { SchemaProvider } from "../../features/schema/schemaProvider";

interface RightPanelProps {
  historyEntries: readonly QueryHistoryEntry[];
  onClearHistory: () => void;
  onInspectHistory: () => void;
  onInsertSql: (sql: string) => void;
  onRemoveHistoryEntry: (entryId: string) => void;
  schemaProvider: SchemaProvider;
  schemaRefreshToken: number;
  sessionState: KansoSessionState;
  visible: boolean;
}

export function RightPanel({
  historyEntries,
  onClearHistory,
  onInspectHistory,
  onInsertSql,
  onRemoveHistoryEntry,
  schemaProvider,
  schemaRefreshToken,
  sessionState,
  visible
}: RightPanelProps) {
  const copySql = (sql: string) => {
    void navigator.clipboard?.writeText(sql);
  };

  return (
    <aside className={visible ? "right-panel" : "right-panel is-hidden"} aria-label="Database context">
      <div className="right-toolbar">
        <Moon size={18} aria-hidden="true" />
      </div>

      <div className="right-content">
        <section className="right-section compact-session" aria-label="Session state">
          <h2>Session</h2>
          <div>
            <span>{sessionState.transactionState === "ACTIVE" ? "Transaction active" : "Transaction inactive"}</span>
            <strong>{sessionState.persistence.dirty ? "Unsaved changes" : "Clean"}</strong>
          </div>
        </section>

        <SchemaExplorer onInsertSql={onInsertSql} provider={schemaProvider} refreshToken={schemaRefreshToken} />

        <QueryHistoryPanel
          entries={historyEntries}
          onClearHistory={onClearHistory}
          onCopySql={copySql}
          onInspectHistory={onInspectHistory}
          onRemoveEntry={onRemoveHistoryEntry}
          onReopenSql={onInsertSql}
          onReplaceSql={onInsertSql}
        />
      </div>
    </aside>
  );
}
