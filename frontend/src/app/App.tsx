import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { LocalKansoClient } from "../engine/LocalKansoClient";
import type { KansoSessionState } from "../engine/KansoClient";
import type { EditorInsertionRequest } from "../features/editor/queryTabTypes";
import { useQueryHistory } from "../features/history/useQueryHistory";
import type { InspectorTab, NavigationKey } from "../types/ui";

const VERSION = "v0.15.0";

export function App() {
  const [activeNavigation, setActiveNavigation] = useState<NavigationKey>("engine");
  const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTab>("tokens");
  const [editorInsertionRequest, setEditorInsertionRequest] = useState<EditorInsertionRequest | null>(null);
  const [schemaRefreshToken, setSchemaRefreshToken] = useState(0);
  const [rightPanelVisible] = useState(true);
  const client = useMemo(() => new LocalKansoClient(), []);
  const [sessionState, setSessionState] = useState<KansoSessionState | null>(null);
  const history = useQueryHistory();

  const refreshSessionState = useCallback(() => {
    void client.getSessionState().then(setSessionState);
  }, [client]);

  useEffect(() => {
    refreshSessionState();
  }, [refreshSessionState]);

  const insertIntoEditor = (text: string) => {
    setEditorInsertionRequest({ id: Date.now(), text });
  };

  if (sessionState === null) {
    return <div className="app-loading" role="status">Loading KansoDB...</div>;
  }

  return (
    <AppShell
      activeInspectorTab={activeInspectorTab}
      activeNavigation={activeNavigation}
      databaseName={sessionState.persistence.databaseName}
      engineState={sessionState.transactionState === "ACTIVE" ? "Transaction active" : "Ready"}
      editorInsertionRequest={editorInsertionRequest}
      kansoClient={client}
      queryHistory={history}
      sessionState={sessionState}
      mode="Local workbench"
      onInsertSql={insertIntoEditor}
      onInspectorTabChange={setActiveInspectorTab}
      onNavigate={setActiveNavigation}
      onSchemaRefresh={() => setSchemaRefreshToken((currentToken) => currentToken + 1)}
      onSessionStateChange={setSessionState}
      onSessionStateRefresh={refreshSessionState}
      rightPanelVisible={rightPanelVisible}
      schemaRefreshToken={schemaRefreshToken}
      version={VERSION}
    />
  );
}
