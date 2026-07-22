import { useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { LocalKansoClient } from "../engine/LocalKansoClient";
import type { EditorInsertionRequest } from "../features/editor/queryTabTypes";
import type { InspectorTab, NavigationKey } from "../types/ui";

const VERSION = "v0.15.0";
const DATABASE_NAME = "company.db";

export function App() {
  const [activeNavigation, setActiveNavigation] = useState<NavigationKey>("engine");
  const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTab>("tokens");
  const [editorInsertionRequest, setEditorInsertionRequest] = useState<EditorInsertionRequest | null>(null);
  const [schemaRefreshToken, setSchemaRefreshToken] = useState(0);
  const [rightPanelVisible] = useState(true);
  const client = useMemo(() => new LocalKansoClient(), []);

  const insertIntoEditor = (text: string) => {
    setEditorInsertionRequest({ id: Date.now(), text });
  };

  return (
    <AppShell
      activeInspectorTab={activeInspectorTab}
      activeNavigation={activeNavigation}
      databaseName={DATABASE_NAME}
      engineState="Ready"
      editorInsertionRequest={editorInsertionRequest}
      kansoClient={client}
      mode="Local workbench"
      onInsertSql={insertIntoEditor}
      onInspectorTabChange={setActiveInspectorTab}
      onNavigate={setActiveNavigation}
      onSchemaRefresh={() => setSchemaRefreshToken((currentToken) => currentToken + 1)}
      rightPanelVisible={rightPanelVisible}
      schemaRefreshToken={schemaRefreshToken}
      version={VERSION}
    />
  );
}
