import { Sidebar } from "./Sidebar";
import { Workspace } from "./Workspace";
import { RightPanel } from "./RightPanel";
import { StatusBar } from "./StatusBar";
import type { KansoClient, KansoSessionState } from "../../engine/KansoClient";
import type { EditorInsertionRequest } from "../../features/editor/queryTabTypes";
import type { useQueryHistory } from "../../features/history/useQueryHistory";
import type { InspectorTab, NavigationKey } from "../../types/ui";

interface AppShellProps {
  activeInspectorTab: InspectorTab;
  activeNavigation: NavigationKey;
  databaseName: string;
  engineState: string;
  editorInsertionRequest: EditorInsertionRequest | null;
  kansoClient: KansoClient;
  mode: string;
  onInspectorTabChange: (tab: InspectorTab) => void;
  onInsertSql: (sql: string) => void;
  onNavigate: (key: NavigationKey) => void;
  onSchemaRefresh: () => void;
  onSessionStateChange: (state: KansoSessionState) => void;
  onSessionStateRefresh: () => void;
  queryHistory: ReturnType<typeof useQueryHistory>;
  rightPanelVisible: boolean;
  schemaRefreshToken: number;
  sessionState: KansoSessionState;
  version: string;
}

export function AppShell({
  activeInspectorTab,
  activeNavigation,
  databaseName,
  engineState,
  editorInsertionRequest,
  kansoClient,
  mode,
  onInspectorTabChange,
  onInsertSql,
  onNavigate,
  onSchemaRefresh,
  onSessionStateChange,
  onSessionStateRefresh,
  queryHistory,
  rightPanelVisible,
  schemaRefreshToken,
  sessionState,
  version
}: AppShellProps) {
  return (
    <div className="app-shell">
      <Sidebar
        activeNavigation={activeNavigation}
        databaseName={databaseName}
        onNavigate={onNavigate}
        version={version}
      />
      <Workspace
        activeInspectorTab={activeInspectorTab}
        editorInsertionRequest={editorInsertionRequest}
        activeNavigation={activeNavigation}
        kansoClient={kansoClient}
        queryHistory={queryHistory}
        onInspectorTabChange={onInspectorTabChange}
        onSchemaRefresh={onSchemaRefresh}
        onSessionStateChange={onSessionStateChange}
        onSessionStateRefresh={onSessionStateRefresh}
        sessionState={sessionState}
      />
      <RightPanel
        historyEntries={queryHistory.entries}
        onClearHistory={queryHistory.clearHistory}
        onInsertSql={onInsertSql}
        onInspectHistory={() => onNavigate("history")}
        onRemoveHistoryEntry={queryHistory.removeHistoryEntry}
        schemaProvider={kansoClient}
        schemaRefreshToken={schemaRefreshToken}
        sessionState={sessionState}
        visible={rightPanelVisible}
      />
      <StatusBar
        databaseName={databaseName}
        engineState={engineState}
        mode={mode}
        persistence={sessionState.persistence}
        transactionState={sessionState.transactionState}
        version={version}
      />
    </div>
  );
}
