import { Sidebar } from "./Sidebar";
import { Workspace } from "./Workspace";
import { RightPanel } from "./RightPanel";
import { StatusBar } from "./StatusBar";
import type { KansoClient } from "../../engine/KansoClient";
import type { EditorInsertionRequest } from "../../features/editor/queryTabTypes";
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
  rightPanelVisible: boolean;
  schemaRefreshToken: number;
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
  rightPanelVisible,
  schemaRefreshToken,
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
        kansoClient={kansoClient}
        onInspectorTabChange={onInspectorTabChange}
        onSchemaRefresh={onSchemaRefresh}
      />
      <RightPanel
        onInsertSql={onInsertSql}
        schemaProvider={kansoClient}
        schemaRefreshToken={schemaRefreshToken}
        visible={rightPanelVisible}
      />
      <StatusBar databaseName={databaseName} engineState={engineState} mode={mode} version={version} />
    </div>
  );
}
