import { Sidebar } from "./Sidebar";
import { Workspace } from "./Workspace";
import { RightPanel } from "./RightPanel";
import { StatusBar } from "./StatusBar";
import type { KansoClient, KansoSessionState } from "../../engine/KansoClient";
import type { EditorInsertionRequest } from "../../features/editor/queryTabTypes";
import type { useQueryHistory } from "../../features/history/useQueryHistory";
import type { UiPreferences } from "../../features/settings/uiPreferences";
import type { InspectorTab, NavigationKey } from "../../types/ui";

interface AppShellProps {
  activeInspectorTab: InspectorTab;
  activeNavigation: NavigationKey;
  databaseName: string;
  engineState: string;
  editorInsertionRequest: EditorInsertionRequest | null;
  exampleLoadToken: number;
  kansoClient: KansoClient;
  mode: string;
  onInspectorTabChange: (tab: InspectorTab) => void;
  onInsertSql: (sql: string) => void;
  onNavigate: (key: NavigationKey) => void;
  onSchemaRefresh: () => void;
  onSessionStateChange: (state: KansoSessionState) => void;
  onSessionStateRefresh: () => void;
  onUiPreferencesChange: (patch: Partial<UiPreferences>) => void;
  onUiPreferencesReset: () => void;
  preferences: UiPreferences;
  queryHistory: ReturnType<typeof useQueryHistory>;
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
  exampleLoadToken,
  kansoClient,
  mode,
  onInspectorTabChange,
  onInsertSql,
  onNavigate,
  onSchemaRefresh,
  onSessionStateChange,
  onSessionStateRefresh,
  onUiPreferencesChange,
  onUiPreferencesReset,
  preferences,
  queryHistory,
  schemaRefreshToken,
  sessionState,
  version
}: AppShellProps) {
  const shellClassName = [
    "app-shell",
    preferences.sidebarCollapsed ? "is-sidebar-collapsed" : "",
    preferences.rightPanelVisible ? "" : "is-right-panel-hidden"
  ].filter(Boolean).join(" ");

  return (
    <div className={shellClassName}>
      <Sidebar
        activeNavigation={activeNavigation}
        collapsed={preferences.sidebarCollapsed}
        databaseName={databaseName}
        onNavigate={onNavigate}
        onToggleSidebar={() => onUiPreferencesChange({ sidebarCollapsed: !preferences.sidebarCollapsed })}
        version={version}
      />
      <Workspace
        activeInspectorTab={activeInspectorTab}
        editorInsertionRequest={editorInsertionRequest}
        exampleLoadToken={exampleLoadToken}
        activeNavigation={activeNavigation}
        kansoClient={kansoClient}
        onInsertSql={onInsertSql}
        onNavigate={onNavigate}
        onToggleRightPanel={() => onUiPreferencesChange({ rightPanelVisible: !preferences.rightPanelVisible })}
        preferences={preferences}
        queryHistory={queryHistory}
        schemaRefreshToken={schemaRefreshToken}
        onInspectorTabChange={onInspectorTabChange}
        onSchemaRefresh={onSchemaRefresh}
        onSessionStateChange={onSessionStateChange}
        onSessionStateRefresh={onSessionStateRefresh}
        onUiPreferencesChange={onUiPreferencesChange}
        onUiPreferencesReset={onUiPreferencesReset}
        sessionState={sessionState}
      />
      <RightPanel
        historyEntries={queryHistory.entries}
        onClearHistory={queryHistory.clearHistory}
        onInsertSql={onInsertSql}
        onInspectHistory={() => onNavigate("history")}
        onNavigate={onNavigate}
        onRemoveHistoryEntry={queryHistory.removeHistoryEntry}
        schemaProvider={kansoClient}
        schemaRefreshToken={schemaRefreshToken}
        sessionState={sessionState}
        version={version}
        visible={preferences.rightPanelVisible}
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
