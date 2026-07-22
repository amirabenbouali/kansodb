import { useCallback, useEffect, useMemo, useState } from "react";
import { demoWorkspaceDatabaseName } from "../../../src/examples/demo-workspace.js";
import { AppShell } from "../components/layout/AppShell";
import { LocalKansoClient } from "../engine/LocalKansoClient";
import type { KansoSessionState } from "../engine/KansoClient";
import type { EditorInsertionRequest } from "../features/editor/queryTabTypes";
import { useQueryHistory } from "../features/history/useQueryHistory";
import { LearnKansoDialog } from "../features/onboarding/LearnKansoDialog";
import { WelcomeScreen } from "../features/onboarding/WelcomeScreen";
import { useUiPreferences } from "../features/settings/useUiPreferences";
import type { InspectorTab, NavigationKey } from "../types/ui";

const VERSION = "v0.15.0";

export function App() {
  const [activeNavigation, setActiveNavigation] = useState<NavigationKey>("engine");
  const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTab>("tokens");
  const [editorInsertionRequest, setEditorInsertionRequest] = useState<EditorInsertionRequest | null>(null);
  const [exampleLoadToken, setExampleLoadToken] = useState(0);
  const [learnDialogOpen, setLearnDialogOpen] = useState(false);
  const [schemaRefreshToken, setSchemaRefreshToken] = useState(0);
  const client = useMemo(() => new LocalKansoClient(), []);
  const [sessionState, setSessionState] = useState<KansoSessionState | null>(null);
  const history = useQueryHistory();
  const { preferences, resetPreferences, updatePreferences } = useUiPreferences();

  const refreshSessionState = useCallback(() => {
    void client.getSessionState().then(setSessionState);
  }, [client]);

  useEffect(() => {
    refreshSessionState();
  }, [refreshSessionState]);

  const insertIntoEditor = (text: string) => {
    setEditorInsertionRequest({ id: Date.now(), text });
  };

  const completeOnboarding = useCallback((patch: Partial<typeof preferences> = {}) => {
    updatePreferences({ ...patch, onboardingComplete: true });
  }, [preferences, updatePreferences]);

  const startExampleWorkspace = useCallback(() => {
    void client.loadExampleDatabase().then((state) => {
      setSessionState(state);
      setSchemaRefreshToken((currentToken) => currentToken + 1);
      setExampleLoadToken((currentToken) => currentToken + 1);
      completeOnboarding();
    });
  }, [client, completeOnboarding]);

  const startMemoryWorkspace = useCallback(() => {
    void client.createInMemoryDatabase().then((state) => {
      setSessionState(state);
      setSchemaRefreshToken((currentToken) => currentToken + 1);
      completeOnboarding();
    });
  }, [client, completeOnboarding]);

  const openDefaultWorkspace = useCallback(() => {
    void client.openDatabase(demoWorkspaceDatabaseName).then((state) => {
      setSessionState(state);
      setSchemaRefreshToken((currentToken) => currentToken + 1);
      completeOnboarding();
    });
  }, [client, completeOnboarding]);

  if (sessionState === null) {
    return <div className="app-loading" role="status">Loading KansoDB...</div>;
  }

  if (!preferences.onboardingComplete) {
    return (
      <>
        <WelcomeScreen
          onLearn={() => setLearnDialogOpen(true)}
          onLoadExample={startExampleWorkspace}
          onNewMemory={startMemoryWorkspace}
          onOpenDatabase={openDefaultWorkspace}
        />
        <LearnKansoDialog open={learnDialogOpen} onClose={() => setLearnDialogOpen(false)} />
      </>
    );
  }

  return (
    <>
      <div className="minimum-layout-message" role="status">
        KansoDB Workbench needs a wider browser window for the editor, schema, and results panels.
      </div>
      <AppShell
        activeInspectorTab={activeInspectorTab}
        activeNavigation={activeNavigation}
        databaseName={sessionState.persistence.databaseName}
        engineState={sessionState.transactionState === "ACTIVE" ? "Transaction active" : "Ready"}
        editorInsertionRequest={editorInsertionRequest}
        exampleLoadToken={exampleLoadToken}
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
        onUiPreferencesChange={updatePreferences}
        onUiPreferencesReset={resetPreferences}
        preferences={preferences}
        schemaRefreshToken={schemaRefreshToken}
        version={VERSION}
      />
    </>
  );
}
