import { useCallback, useEffect, useRef, useState } from "react";
import type { AutoSaveModeView, KansoClient, KansoSessionState } from "../../engine/KansoClient";
import type { InspectorTab, NavigationKey } from "../../types/ui";
import { CommandPalette } from "../../features/commands/CommandPalette";
import type { CommandAction } from "../../features/commands/commandTypes";
import { EmptyEditor } from "../../features/editor/EmptyEditor";
import { EditorToolbar } from "../../features/editor/EditorToolbar";
import { QueryTabs } from "../../features/editor/QueryTabs";
import { SqlEditor } from "../../features/editor/SqlEditor";
import type { EditorInsertionRequest, QueryTab } from "../../features/editor/queryTabTypes";
import { useQueryTabs } from "../../features/editor/useQueryTabs";
import { EngineView } from "../../features/engine/EngineView";
import { TokenInspector } from "../../features/engine-inspector/TokenInspector";
import { ExecutionPanel } from "../../features/execution/ExecutionPanel";
import { useQueryExecution } from "../../features/execution/useQueryExecution";
import { QueryHistoryPage } from "../../features/history/QueryHistoryPage";
import { createHistoryDetail, createHistoryEntry } from "../../features/history/historyTypes";
import type { useQueryHistory } from "../../features/history/useQueryHistory";
import { ScriptsNavigationPage, TablesNavigationPage } from "../../features/navigation/NavigationPages";
import { exampleQueries } from "../../features/onboarding/sampleWorkspace";
import { AutoSaveSettings } from "../../features/persistence/AutoSaveSettings";
import { DatabaseMenu } from "../../features/persistence/DatabaseMenu";
import { OpenDatabaseDialog } from "../../features/persistence/OpenDatabaseDialog";
import { PersistenceStatus } from "../../features/persistence/PersistenceStatus";
import { SaveButton } from "../../features/persistence/SaveButton";
import { browserPersistenceLimitations } from "../../features/persistence/persistenceCapabilities";
import { ScriptExecutionOptions } from "../../features/scripts/ScriptExecutionOptions";
import { SettingsPanel } from "../../features/settings/SettingsPanel";
import type { UiPreferences } from "../../features/settings/uiPreferences";
import { TransactionControls } from "../../features/transactions/TransactionControls";
import { TransactionIndicator } from "../../features/transactions/TransactionIndicator";
import type { TokenTraceView } from "../../engine/tracing/traceTypes";
import { TransactionWarningDialog } from "../../features/transactions/TransactionWarningDialog";
import { ErrorBoundary } from "../shared/ErrorBoundary";

interface WorkspaceProps {
  activeNavigation: NavigationKey;
  activeInspectorTab: InspectorTab;
  editorInsertionRequest: EditorInsertionRequest | null;
  exampleLoadToken: number;
  kansoClient: KansoClient;
  onInsertSql: (sql: string) => void;
  onNavigate: (key: NavigationKey) => void;
  onToggleRightPanel: () => void;
  preferences: UiPreferences;
  queryHistory: ReturnType<typeof useQueryHistory>;
  schemaRefreshToken: number;
  onInspectorTabChange: (tab: InspectorTab) => void;
  onSchemaRefresh: () => void;
  onSessionStateChange: (state: KansoSessionState) => void;
  onSessionStateRefresh: () => void;
  onUiPreferencesChange: (patch: Partial<UiPreferences>) => void;
  onUiPreferencesReset: () => void;
  sessionState: KansoSessionState;
}

export function Workspace({
  activeNavigation,
  activeInspectorTab,
  editorInsertionRequest,
  exampleLoadToken,
  kansoClient,
  onInsertSql,
  onNavigate,
  onToggleRightPanel,
  preferences,
  queryHistory,
  schemaRefreshToken,
  onInspectorTabChange,
  onSchemaRefresh,
  onSessionStateChange,
  onSessionStateRefresh,
  onUiPreferencesChange,
  onUiPreferencesReset,
  sessionState
}: WorkspaceProps) {
  const workbenchRef = useRef<HTMLElement | null>(null);
  const [closeConfirmation, setCloseConfirmation] = useState<QueryTab | null>(null);
  const [highlightedSqlRange, setHighlightedSqlRange] = useState<{ start: number; end: number } | null>(null);
  const [databaseDialogOpen, setDatabaseDialogOpen] = useState(false);
  const [selectedInspectorToken, setSelectedInspectorToken] = useState<TokenTraceView | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
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
    loadTabs,
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

  useEffect(() => {
    if (exampleLoadToken > 0) {
      loadTabs(exampleQueries.map(({ title, sql }) => ({ title, sql })));
    }
  }, [exampleLoadToken, loadTabs]);

  useEffect(() => {
    setSelectedInspectorToken(null);
  }, [activeTabId, activeTab?.execution?.executedSql]);

  const selectInspectorToken = useCallback((token: TokenTraceView) => {
    setSelectedInspectorToken(token);
    setHighlightedSqlRange(token.start === token.end ? null : { start: token.start, end: token.end });
  }, []);

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

      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(true);
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

  useEffect(() => {
    void kansoClient.setAutoSaveMode(preferences.autoSaveMode).then(onSessionStateChange);
  }, [kansoClient, onSessionStateChange, preferences.autoSaveMode]);

  const commands: CommandAction[] = [
    { id: "new-query", label: "New query", group: "Editor", shortcut: "Ctrl/Cmd T", run: addAndFocusTab },
    { id: "execute-query", label: "Execute query", group: "Editor", shortcut: "Ctrl/Cmd Enter", run: () => void handleExecute() },
    { id: "open-database", label: "Open database", group: "Database", run: () => setDatabaseDialogOpen(true) },
    { id: "save-database", label: "Save database", group: "Database", run: () => void runControlSql("SAVE;") },
    { id: "show-tables", label: "Show tables", group: "Navigation", run: () => onNavigate("tables") },
    { id: "show-engine", label: "Show engine", group: "Navigation", run: () => onNavigate("engine") },
    { id: "begin-transaction", label: "Begin transaction", group: "Transaction", run: () => void runControlSql("BEGIN;") },
    { id: "commit-transaction", label: "Commit transaction", group: "Transaction", run: () => void runControlSql("COMMIT;") },
    { id: "rollback-transaction", label: "Rollback transaction", group: "Transaction", run: () => void runControlSql("ROLLBACK;") },
    { id: "toggle-right-panel", label: "Toggle right panel", group: "View", run: onToggleRightPanel },
    { id: "open-settings", label: "Open settings", group: "Navigation", run: () => onNavigate("settings") }
  ];

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

  if (activeNavigation === "settings") {
    return (
      <main className="workspace page-workspace" ref={workbenchRef}>
        <SettingsPanel preferences={preferences} onChange={onUiPreferencesChange} onReset={onUiPreferencesReset} />
        <CommandPalette commands={commands} open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
      </main>
    );
  }

  if (activeNavigation === "tables") {
    return (
      <TablesNavigationPage
        provider={kansoClient}
        refreshToken={schemaRefreshToken}
        onInsertSql={(sql) => {
          onInsertSql(sql);
          onNavigate("console");
        }}
      />
    );
  }

  if (activeNavigation === "scripts") {
    return (
      <ScriptsNavigationPage
        atomic={atomicScript}
        stopOnError={stopOnError}
        onAtomicChange={setAtomicScript}
        onStopOnErrorChange={setStopOnError}
        onLoadScript={(sql) => {
          replaceCurrentSql(sql);
          onNavigate("console");
        }}
      />
    );
  }

  return (
    <main className="workspace" ref={workbenchRef}>
      <span className="sr-only" aria-live="polite">
        {activeTab?.execution?.status === "success" ? "Execution completed successfully." : null}
        {activeTab?.execution?.status === "error" ? `Execution failed: ${activeTab.execution.error?.message ?? "Unknown error"}` : null}
      </span>
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
              <ErrorBoundary label="Editor">
                <SqlEditor
                  diagnosticRange={errorDiagnosticRange(activeTab.execution)}
                  editorFontSize={preferences.editorFontSize}
                  editorWordWrap={preferences.editorWordWrap}
                  insertionRequest={editorInsertionRequest}
                  highlightedRange={highlightedSqlRange ?? errorHighlightRange(activeTab.execution)}
                  key={activeTab.id}
                  onExecute={handleExecute}
                  onNewTab={addAndFocusTab}
                  onSave={handleSave}
                  onSqlChange={(sql) => updateTabSql(activeTab.id, sql)}
                  reducedMotion={preferences.reducedMotion}
                  sql={activeTab.sql}
                />
              </ErrorBoundary>
            </div>
            <EditorToolbar
              canExecute={activeTab.sql.trim().length > 0}
              executionRunning={runningTabId === activeTab.id}
              onCancelExecutionDisplay={cancelDisplay}
              onExecute={handleExecute}
              onSave={handleSave}
            />
            <details className="workbench-controls">
              <summary>
                <span>{sessionState.persistence.storageKind === "browser-file" ? "Browser file" : "In-memory"}</span>
                <strong>{sessionState.transactionState === "ACTIVE" ? "Transaction active" : "Ready"}</strong>
              </summary>
              <div className="session-control-panel">
                <TransactionIndicator state={sessionState.transactionState} />
                <TransactionControls
                  disabled={running}
                  state={sessionState.transactionState}
                  onBegin={() => void runControlSql("BEGIN;")}
                  onCommit={() => void runControlSql("COMMIT;")}
                  onRollback={() => void runControlSql("ROLLBACK;")}
                />
                <PersistenceStatus persistence={sessionState.persistence} transactionState={sessionState.transactionState} />
                <div className="compact-control-row">
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
                </div>
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
              </div>
            </details>
            {saveMessage !== null ? <span className="save-toast" role="status">{saveMessage}</span> : null}
          </>
        )}
      </section>

      {activeNavigation === "engine" ? (
        <ErrorBoundary label="Engine inspector">
          <EngineView
            execution={activeTab?.execution}
            running={activeTab !== null && runningTabId === activeTab.id}
            onSelectSqlRange={setHighlightedSqlRange}
          />
        </ErrorBoundary>
      ) : null}

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
          <ErrorBoundary label="Token inspector">
            <TokenInspector
              error={activeTab?.execution?.error ?? null}
              selectedToken={selectedInspectorToken}
              tokens={activeTab?.execution?.trace?.tokens ?? []}
              onSelectToken={selectInspectorToken}
            />
          </ErrorBoundary>
        ) : (
          <ErrorBoundary label="Result panel">
            <ExecutionPanel
              running={activeTab !== null && runningTabId === activeTab.id}
              snapshot={activeTab?.execution ?? null}
              transactionActive={sessionState.transactionState === "ACTIVE"}
            />
          </ErrorBoundary>
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
      <CommandPalette commands={commands} open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
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
