import { Boxes, Code2, Database, ExternalLink, Keyboard, Moon, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { KansoSessionState } from "../../engine/KansoClient";
import type { NavigationKey } from "../../types/ui";
import { ErrorBoundary } from "../shared/ErrorBoundary";
import { QueryHistoryPanel } from "../../features/history/QueryHistoryPanel";
import type { QueryHistoryEntry } from "../../features/history/historyTypes";
import { SchemaExplorer } from "../../features/schema/SchemaExplorer";
import type { SchemaProvider } from "../../features/schema/schemaProvider";

interface RightPanelProps {
  historyEntries: readonly QueryHistoryEntry[];
  onClearHistory: () => void;
  onInspectHistory: () => void;
  onInsertSql: (sql: string) => void;
  onNavigate: (key: NavigationKey) => void;
  onRemoveHistoryEntry: (entryId: string) => void;
  schemaProvider: SchemaProvider;
  schemaRefreshToken: number;
  sessionState: KansoSessionState;
  version: string;
  visible: boolean;
}

export function RightPanel({
  historyEntries,
  onClearHistory,
  onInspectHistory,
  onInsertSql,
  onNavigate,
  onRemoveHistoryEntry,
  schemaProvider,
  schemaRefreshToken,
  sessionState,
  version,
  visible
}: RightPanelProps) {
  const [workbenchMenuOpen, setWorkbenchMenuOpen] = useState(false);
  const workbenchMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!workbenchMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (workbenchMenuRef.current !== null && !workbenchMenuRef.current.contains(event.target as Node)) {
        setWorkbenchMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setWorkbenchMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [workbenchMenuOpen]);

  const copySql = (sql: string) => {
    void navigator.clipboard?.writeText(sql);
  };

  const navigateToSettings = () => {
    onNavigate("settings");
    setWorkbenchMenuOpen(false);
  };

  return (
    <aside className={visible ? "right-panel" : "right-panel is-hidden"} aria-label="Database context">
      <div className="right-toolbar">
        <span className="storage-pill">
          <Database size={13} strokeWidth={2} aria-hidden="true" />
          {sessionState.persistence.storageKind === "browser-file" ? sessionState.persistence.databaseName : "In-memory"}
        </span>
        <Moon size={15} strokeWidth={2} aria-hidden="true" />
        <div className="workbench-menu-wrap" ref={workbenchMenuRef}>
          <button
            className="workbench-menu-trigger"
            type="button"
            aria-expanded={workbenchMenuOpen}
            aria-haspopup="menu"
            aria-label="KansoDB local workspace menu"
            onClick={() => setWorkbenchMenuOpen((current) => !current)}
          >
            <Boxes size={15} strokeWidth={2} aria-hidden="true" />
            <i aria-hidden="true" />
          </button>
          {workbenchMenuOpen ? (
            <div className="workbench-menu" role="menu" aria-label="KansoDB local workspace">
              <div className="workbench-menu-card">
                <strong>KansoDB</strong>
                <span>Local workspace</span>
                <code>{version}</code>
              </div>
              <button type="button" role="menuitem" onClick={navigateToSettings}>
                <Settings size={14} aria-hidden="true" />
                Preferences
              </button>
              <button type="button" role="menuitem" onClick={navigateToSettings}>
                <Keyboard size={14} aria-hidden="true" />
                Keyboard shortcuts
              </button>
              <div className="workbench-menu-about" role="menuitem">
                <Boxes size={14} aria-hidden="true" />
                About KansoDB
              </div>
              <a href="https://github.com/amirabenbouali/kansodb" target="_blank" rel="noreferrer" role="menuitem">
                <Code2 size={14} aria-hidden="true" />
                GitHub
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            </div>
          ) : null}
        </div>
      </div>

      <div className="right-content">
        <section className="right-section compact-session" aria-label="Session state">
          <h2>Session</h2>
          <div>
            <span>{sessionState.transactionState === "ACTIVE" ? "Transaction active" : "Transaction inactive"}</span>
            <strong>{sessionState.persistence.dirty ? "Unsaved changes" : "Clean"}</strong>
          </div>
        </section>

        <ErrorBoundary label="Schema explorer">
          <SchemaExplorer onInsertSql={onInsertSql} provider={schemaProvider} refreshToken={schemaRefreshToken} />
        </ErrorBoundary>

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
