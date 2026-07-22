import { Check } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { KansoClient } from "../../engine/KansoClient";
import type { InspectorTab, PipelineStage } from "../../types/ui";
import { EmptyEditor } from "../../features/editor/EmptyEditor";
import { EditorToolbar } from "../../features/editor/EditorToolbar";
import { QueryTabs } from "../../features/editor/QueryTabs";
import { SqlEditor } from "../../features/editor/SqlEditor";
import type { EditorInsertionRequest, QueryTab } from "../../features/editor/queryTabTypes";
import { useQueryTabs } from "../../features/editor/useQueryTabs";
import { ExecutionPanel } from "../../features/execution/ExecutionPanel";
import { useQueryExecution } from "../../features/execution/useQueryExecution";

const pipelineStages: PipelineStage[] = [
  { id: "sql", label: "SQL", detail: "Query text", duration: "1.2 ms", status: "complete" },
  { id: "lexer", label: "Lexer", detail: "28 tokens", duration: "0.3 ms", status: "complete" },
  { id: "parser", label: "Parser", detail: "AST generated", duration: "0.6 ms", status: "complete" },
  { id: "ast", label: "AST", detail: "SelectStatement", duration: "0.4 ms", status: "complete" },
  { id: "executor", label: "Executor", detail: "Running operators", duration: "1.7 ms", status: "active" },
  { id: "storage", label: "Storage", detail: "Reading data", duration: "2.1 ms", status: "pending" },
  { id: "results", label: "Results", detail: "10 rows", duration: "0.4 ms", status: "pending" }
];

interface WorkspaceProps {
  activeInspectorTab: InspectorTab;
  editorInsertionRequest: EditorInsertionRequest | null;
  kansoClient: KansoClient;
  onInspectorTabChange: (tab: InspectorTab) => void;
  onSchemaRefresh: () => void;
}

export function Workspace({
  activeInspectorTab,
  editorInsertionRequest,
  kansoClient,
  onInspectorTabChange,
  onSchemaRefresh
}: WorkspaceProps) {
  const workbenchRef = useRef<HTMLElement | null>(null);
  const [closeConfirmation, setCloseConfirmation] = useState<QueryTab | null>(null);
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
    onSchemaRefreshNeeded: onSchemaRefresh,
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
                insertionRequest={editorInsertionRequest}
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

      <section className="pipeline-strip" aria-label="Execution pipeline placeholder">
        {pipelineStages.map((stage) => (
          <button className="pipeline-node" key={stage.id} type="button">
            <span>{stage.label}</span>
            <small>{stage.duration}</small>
            <i className={`stage-dot is-${stage.status}`}>
              {stage.status === "complete" ? <Check size={15} aria-hidden="true" /> : null}
            </i>
          </button>
        ))}
      </section>

      <section className="engine-grid">
        <aside className="stage-list">
          <div className="section-heading">
            <h2>Execution Pipeline</h2>
          </div>
          <div className="stage-list-stack">
            {pipelineStages.map((stage) => (
              <button className={stage.status === "active" ? "stage-row is-active" : "stage-row"} key={stage.id} type="button">
                <i className={`stage-dot is-${stage.status}`}>
                  {stage.status === "complete" ? <Check size={15} aria-hidden="true" /> : null}
                </i>
                <span>
                  <strong>{stage.label}</strong>
                  <small>{stage.detail}</small>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="execution-canvas" aria-label="Execution plan placeholder">
          <div className="section-heading">
            <h2>Execution Plan</h2>
            <span>Ready</span>
          </div>
          <div className="plan-tree">
            <Operator label="Limit" detail="10" />
            <div className="tree-line" />
            <Operator label="Sort" detail="e.salary DESC" />
            <div className="tree-line" />
            <Operator label="Filter" detail="e.salary > 50000 AND e.is_active = TRUE" active />
            <div className="tree-line" />
            <Operator label="Hash Join" detail="e.department_id = d.id" />
            <div className="branch-line" />
            <div className="table-scans">
              <Operator label="Table Scan" detail="employees · 124 rows" />
              <Operator label="Table Scan" detail="departments · 12 rows" />
            </div>
          </div>
        </section>

        <aside className="operator-detail">
          <section className="detail-card" aria-label="Operator details placeholder">
            <p className="eyebrow">Operator Details</p>
            <h3>Filter</h3>
            <dl>
              <div>
                <dt>Condition</dt>
                <dd>e.salary &gt; 50000</dd>
              </div>
              <div>
                <dt>Rows in</dt>
                <dd>124</dd>
              </div>
              <div>
                <dt>Rows out</dt>
                <dd>38</dd>
              </div>
            </dl>
          </section>
        </aside>
      </section>

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
          />
        )}
      </section>
    </main>
  );
}

interface OperatorProps {
  active?: boolean;
  detail: string;
  label: string;
}

function Operator({ active = false, detail, label }: OperatorProps) {
  return (
    <div className={active ? "operator is-active" : "operator"}>
      <strong>{label}</strong>
      <small>{detail}</small>
    </div>
  );
}
