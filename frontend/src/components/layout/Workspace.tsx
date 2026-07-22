import { useCallback, useEffect, useRef, useState } from "react";
import type { AutoSaveModeView, KansoClient, KansoSessionState, TransactionStateView } from "../../engine/KansoClient";
import type { InspectorTab, NavigationKey } from "../../types/ui";
import { EmptyEditor } from "../../features/editor/EmptyEditor";
import { EditorToolbar } from "../../features/editor/EditorToolbar";
import { QueryTabs } from "../../features/editor/QueryTabs";
import { SqlEditor } from "../../features/editor/SqlEditor";
import type { EditorInsertionRequest, QueryTab } from "../../features/editor/queryTabTypes";
import { useQueryTabs } from "../../features/editor/useQueryTabs";
import { EngineInspector } from "../../features/engine-inspector/EngineInspector";
import { ExecutionPanel } from "../../features/execution/ExecutionPanel";
import { useQueryExecution } from "../../features/execution/useQueryExecution";
import { QueryHistoryPage } from "../../features/history/QueryHistoryPage";
import { createHistoryDetail, createHistoryEntry } from "../../features/history/historyTypes";
import type { useQueryHistory } from "../../features/history/useQueryHistory";
import { AutoSaveSettings } from "../../features/persistence/AutoSaveSettings";
import { DatabaseMenu } from "../../features/persistence/DatabaseMenu";
import { OpenDatabaseDialog } from "../../features/persistence/OpenDatabaseDialog";
import { PersistenceStatus } from "../../features/persistence/PersistenceStatus";
import { SaveButton } from "../../features/persistence/SaveButton";
import { browserPersistenceLimitations } from "../../features/persistence/persistenceCapabilities";
import { ScriptExecutionOptions } from "../../features/scripts/ScriptExecutionOptions";
import { TransactionControls } from "../../features/transactions/TransactionControls";
import { TransactionIndicator } from "../../features/transactions/TransactionIndicator";
import { TransactionWarningDialog } from "../../features/transactions/TransactionWarningDialog";

interface WorkspaceProps {
  activeNavigation: NavigationKey;
  activeInspectorTab: InspectorTab;
  editorInsertionRequest: EditorInsertionRequest | null;
  kansoClient: KansoClient;
  queryHistory: ReturnType<typeof useQueryHistory>;
  onInspectorTabChange: (tab: InspectorTab) => void;
  onSchemaRefresh: () => void;
  onSessionStateChange: (state: KansoSessionState) => void;
  onSessionStateRefresh: () => void;
  sessionState: KansoSessionState;
}

export function Workspace({
  activeNavigation,
  activeInspectorTab,
  editorInsertionRequest,
  kansoClient,
  queryHistory,
  onInspectorTabChange,
  onSchemaRefresh,
  onSessionStateChange,
  onSessionStateRefresh,
  sessionState
}: WorkspaceProps) {
  const workbenchRef = useRef<HTMLElement | null>(null);
  const [closeConfirmation, setCloseConfirmation] = useState<QueryTab | null>(null);
  const [highlightedSqlRange, setHighlightedSqlRange] = useState<{ start: number; end: number } | null>(null);
  const [databaseDialogOpen, setDatabaseDialogOpen] = useState(false);
  const [transactionWarning, setTransactionWarning] = useState<(() => Promise<void>) | null>(null);
  const [atomicScript, setAtomicScript] = useState(false);
  const [stopOnError, setStopOnError] = useState(true);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const {
    activeTab,
    activeTabId,
    addTab,
    closeTab,
    renameTab,
    saveTab,
    setActiveTabId,
    tabs,
    updateTabExecution,
    updateTabSql
  } = useQueryTabs();
  const { cancelDisplay, executeTab, running, runningTabId } = useQueryExecution({
    client: kansoClient,
    onExecutionRecorded: (tab, snapshot) => {
      queryHistory.addHistoryRecord(
        createHistoryEntry(tab.id, tab.sql, snapshot),
        createHistoryDetail(snapshot)
      );
    },
    onSchemaRefreshNeeded: onSchemaRefresh,
    onSessionStateRefreshNeeded: onSessionStateRefresh,
    scriptOptions: {
      atomic: atomicScript,
      stopOnError
    },
    onTabExecutionChange: updateTabExecution
  });

  const handleExecute = useCallback(async () => {
    if (activeTab === null || running) {
      return;
    }

    onInspectorTabChange("output");
    await executeTab(activeTab);
  }, [activeTab, executeTab, onInspectorTabChange, running]);

  const handleSave = useCallback(() => {
    if (activeTab === null) {
      return;
    }

    saveTab(activeTab.id);
    setSaveMessage(`${activeTab.title} saved locally`);
    window.setTimeout(() => setSaveMessage(null), 1800);
  }, [activeTab, saveTab]);

  const runControlSql = useCallback(async (sql: string) => {
    if (running) {
      return;
    }

    await executeAdHocSql({
      activeTab,
      client: kansoClient,
      onExecutionRecorded: queryHistory.addHistoryRecord,
      onInspectorTabChange,
      onSchemaRefresh,
      onSessionStateRefresh,
      onTabExecutionChange: updateTabExecution,
      sql
    });
  }, [activeTab, kansoClient, onInspectorTabChange, onSchemaRefresh, onSessionStateRefresh, queryHistory.addHistoryRecord, running, updateTabExecution]);

  const applySessionChange = useCallback(async (action: () => Promise<KansoSessionState>) => {
    const state = await action();
    onSessionStateChange(state);
    onSchemaRefresh();
  }, [onSchemaRefresh, onSessionStateChange]);

  const withTransactionSafeguard = useCallback((action: () => Promise<void>) => {
    if (sessionState.transactionState === "ACTIVE") {
      setTransactionWarning(() => action);
      return;
    }

    void action();
  }, [sessionState.transactionState]);

  const rollbackThenContinue = useCallback(async () => {
    const pendingAction = transactionWarning;
    setTransactionWarning(null);
    await runControlSql("ROLLBACK;");
    if (pendingAction !== null) {
      await pendingAction();
    }
  }, [runControlSql, transactionWarning]);

  const requestCloseTab = useCallback((tab: QueryTab) => {
    if (tab.isDirty) {
      setCloseConfirmation(tab);
      return;
    }

    closeTab(tab.id);
  }, [closeTab]);

  const confirmCloseTab = useCallback(() => {
    if (closeConfirmation === null) {
      return;
    }

    closeTab(closeConfirmation.id);
    setCloseConfirmation(null);
  }, [closeConfirmation, closeTab]);

  const addAndFocusTab = useCallback(() => {
    addTab();
  }, [addTab]);

  const reopenSql = useCallback((sql: string) => {
    addTab(sql);
  }, [addTab]);

  const replaceCurrentSql = useCallback((sql: string) => {
    if (activeTab === null) {
      addTab(sql);
      return;
    }

    updateTabSql(activeTab.id, sql);
  }, [activeTab, addTab, updateTabSql]);

  const copySql = useCallback((sql: string) => {
    void navigator.clipboard?.writeText(sql);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const modifierPressed = event.metaKey || event.ctrlKey;
      if (!modifierPressed || workbenchRef.current === null) {
        return;
      }

      const activeElement = document.activeElement;
      if (activeElement !== null && !workbenchRef.current.contains(activeElement)) {
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        void handleExecute();
      }

      if (event.key.toLowerCase() === "t") {
        event.preventDefault();
        addAndFocusTab();
      }

      if (event.key.toLowerCase() === "w") {
        event.preventDefault();
        if (activeTab !== null) {
          requestCloseTab(activeTab);
        }
      }

      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        handleSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, addAndFocusTab, handleExecute, handleSave, requestCloseTab]);

  if (activeNavigation === "history") {
    return (
      <QueryHistoryPage
        entries={queryHistory.entries}
        getHistoryDetail={queryHistory.getHistoryDetail}
        onClearHistory={queryHistory.clearHistory}
        onCopySql={copySql}
        onRemoveEntry={queryHistory.removeHistoryEntry}
        onReopenSql={reopenSql}
        onReplaceSql={replaceCurrentSql}
      />
    );
  }

  return (
    <main className="workspace" ref={workbenchRef}>
      <QueryTabs
        activeTabId={activeTabId}
        closeConfirmation={closeConfirmation}
        onAddTab={addAndFocusTab}
        onCancelClose={() => setCloseConfirmation(null)}
        onCloseTab={requestCloseTab}
        onConfirmClose={confirmCloseTab}
        onRenameTab={renameTab}
        onSelectTab={setActiveTabId}
        tabs={tabs}
      />

      <section className="editor-panel" aria-label="SQL editor placeholder">
        {activeTab === null ? (
          <EmptyEditor onNewQuery={addAndFocusTab} />
        ) : (
          <>
            <div className="editor-surface">
              <SqlEditor
                diagnosticRange={errorDiagnosticRange(activeTab.execution)}
                insertionRequest={editorInsertionRequest}
                highlightedRange={highlightedSqlRange ?? errorHighlightRange(activeTab.execution)}
                key={activeTab.id}
                onExecute={handleExecute}
                onNewTab={addAndFocusTab}
                onSave={handleSave}
                onSqlChange={(sql) => updateTabSql(activeTab.id, sql)}
                sql={activeTab.sql}
              />
            </div>
            <EditorToolbar
              canExecute={activeTab.sql.trim().length > 0}
              executionRunning={runningTabId === activeTab.id}
              onCancelExecutionDisplay={cancelDisplay}
              onExecute={handleExecute}
              onSave={handleSave}
            />
            {saveMessage !== null ? <span className="save-toast" role="status">{saveMessage}</span> : null}
          </>
        )}
      </section>

      <section className="session-strip" aria-label="Database session controls">
        <TransactionIndicator state={sessionState.transactionState} />
        <TransactionControls
          disabled={running}
          state={sessionState.transactionState}
          onBegin={() => void runControlSql("BEGIN;")}
          onCommit={() => void runControlSql("COMMIT;")}
          onRollback={() => void runControlSql("ROLLBACK;")}
        />
        <PersistenceStatus persistence={sessionState.persistence} transactionState={sessionState.transactionState} />
        <SaveButton
          persistence={sessionState.persistence}
          running={running}
          transactionState={sessionState.transactionState}
          onSave={() => void runControlSql("SAVE;")}
        />
        <DatabaseMenu
          persistence={sessionState.persistence}
          onCreateFile={() => withTransactionSafeguard(async () => {
            await applySessionChange(() => kansoClient.createFileBackedDatabase(`database-${Date.now()}.db.json`));
          })}
          onCreateMemory={() => withTransactionSafeguard(async () => {
            await applySessionChange(() => kansoClient.createInMemoryDatabase());
          })}
          onOpen={() => withTransactionSafeguard(async () => setDatabaseDialogOpen(true))}
        />
        <AutoSaveSettings
          disabled={running}
          mode={sessionState.persistence.autoSave}
          onChange={(mode: AutoSaveModeView) => {
            void kansoClient.setAutoSaveMode(mode).then(onSessionStateChange);
          }}
        />
        <ScriptExecutionOptions
          atomic={atomicScript}
          stopOnError={stopOnError}
          onAtomicChange={setAtomicScript}
          onStopOnErrorChange={setStopOnError}
        />
        <p className="runtime-note">{browserPersistenceLimitations(sessionState.persistence.capabilities)}</p>
      </section>

      <EngineInspector
        error={activeTab?.execution?.error ?? null}
        trace={activeTab?.execution?.trace ?? null}
        onSelectSqlRange={setHighlightedSqlRange}
      />

      <section className="inspector">
        <div className="inspector-tabs" role="tablist" aria-label="Inspector tabs">
          <button
            className={activeInspectorTab === "tokens" ? "inspector-tab is-active" : "inspector-tab"}
            type="button"
            role="tab"
            aria-selected={activeInspectorTab === "tokens"}
            onClick={() => onInspectorTabChange("tokens")}
          >
            Tokens
          </button>
          <button
            className={activeInspectorTab === "output" ? "inspector-tab is-active" : "inspector-tab"}
            type="button"
            role="tab"
            aria-selected={activeInspectorTab === "output"}
            onClick={() => onInspectorTabChange("output")}
          >
            Output
          </button>
        </div>
        {activeInspectorTab === "tokens" ? (
          <div className="placeholder-grid">
            {["SELECT", "IDENTIFIER", "FROM", "JOIN", "WHERE"].map((token) => (
              <span className="placeholder-token" key={token}>
                {token}
              </span>
            ))}
          </div>
        ) : (
          <ExecutionPanel
            running={activeTab !== null && runningTabId === activeTab.id}
            snapshot={activeTab?.execution ?? null}
            transactionActive={sessionState.transactionState === "ACTIVE"}
          />
        )}
      </section>

      <OpenDatabaseDialog
        knownDatabases={sessionState.persistence.knownDatabases}
        open={databaseDialogOpen}
        onCancel={() => setDatabaseDialogOpen(false)}
        onCreateFile={(name) => {
          setDatabaseDialogOpen(false);
          void applySessionChange(() => kansoClient.createFileBackedDatabase(name));
        }}
        onCreateMemory={() => {
          setDatabaseDialogOpen(false);
          void applySessionChange(() => kansoClient.createInMemoryDatabase());
        }}
        onOpen={(name) => {
          setDatabaseDialogOpen(false);
          void applySessionChange(() => kansoClient.openDatabase(name));
        }}
      />
      <TransactionWarningDialog
        actionLabel="Changing databases"
        open={transactionWarning !== null}
        onCancel={() => setTransactionWarning(null)}
        onRollback={() => void rollbackThenContinue()}
      />
    </main>
  );
}

async function executeAdHocSql(options: {
  activeTab: QueryTab | null;
  client: KansoClient;
  onExecutionRecorded: ReturnType<typeof useQueryHistory>["addHistoryRecord"];
  onInspectorTabChange: (tab: InspectorTab) => void;
  onSchemaRefresh: () => void;
  onSessionStateRefresh: () => void;
  onTabExecutionChange: (tabId: string, execution: QueryTab["execution"]) => void;
  sql: string;
}): Promise<void> {
  const startedAt = performance.now();
  options.onInspectorTabChange("output");

  try {
    const result = await options.client.executeWithTrace(options.sql);
    const snapshot: NonNullable<QueryTab["execution"]> = {
      status: "success",
      result: result.result,
      error: null,
      executionTimeMs: result.result.durationMs,
      executedSql: options.sql,
      trace: result.trace
    };

    if (options.activeTab !== null) {
      options.onTabExecutionChange(options.activeTab.id, snapshot);
      options.onExecutionRecorded(createHistoryEntry(options.activeTab.id, options.sql, snapshot), createHistoryDetail(snapshot));
    }

    if (result.result.type !== "query") {
      options.onSchemaRefresh();
    }
  } catch (error) {
    const mappedError = isTracedError(error) ? error.error : null;
    const snapshot: NonNullable<QueryTab["execution"]> = {
      status: "error",
      result: null,
      error: mappedError ?? {
        code: "UNKNOWN_ERROR",
        message: error instanceof Error ? error.message : "An unknown KansoDB error occurred."
      },
      executionTimeMs: performance.now() - startedAt,
      executedSql: options.sql,
      trace: isTracedError(error) ? error.trace : null
    };

    if (options.activeTab !== null) {
      options.onTabExecutionChange(options.activeTab.id, snapshot);
      options.onExecutionRecorded(createHistoryEntry(options.activeTab.id, options.sql, snapshot), createHistoryDetail(snapshot));
    }
  } finally {
    options.onSessionStateRefresh();
  }
}

function isTracedError(value: unknown): value is { error: NonNullable<QueryTab["execution"]>["error"]; trace: NonNullable<QueryTab["execution"]>["trace"] } {
  return typeof value === "object"
    && value !== null
    && "error" in value
    && "trace" in value;
}

function errorDiagnosticRange(execution: QueryTab["execution"]): { start: number; end: number; message: string } | null {
  const error = execution?.error;
  const metadata = error?.metadata;

  if (error === undefined || error === null || metadata === undefined) {
    return null;
  }

  const start = typeof metadata.start === "number" ? metadata.start : undefined;
  const end = typeof metadata.end === "number" ? metadata.end : undefined;
  if (start !== undefined && end !== undefined) {
    return { start, end, message: error.message };
  }

  if (typeof metadata.position === "number") {
    return { start: metadata.position, end: metadata.position + 1, message: error.message };
  }

  if (typeof metadata.position === "object" && metadata.position !== null && "start" in metadata.position && "end" in metadata.position) {
    const position = metadata.position as { start?: unknown; end?: unknown };
    if (typeof position.start === "number" && typeof position.end === "number") {
      return { start: position.start, end: position.end, message: error.message };
    }
  }

  return null;
}

function errorHighlightRange(execution: QueryTab["execution"]): { start: number; end: number } | null {
  const diagnosticRange = errorDiagnosticRange(execution);
  return diagnosticRange === null ? null : { start: diagnosticRange.start, end: diagnosticRange.end };
}
