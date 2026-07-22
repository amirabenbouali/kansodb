import { FileCode2, Table2, TerminalSquare } from "lucide-react";
import type { SchemaProvider } from "../schema/schemaProvider";
import { SchemaExplorer } from "../schema/SchemaExplorer";
import { ScriptExecutionOptions } from "../scripts/ScriptExecutionOptions";

interface TablesNavigationPageProps {
  provider: SchemaProvider;
  refreshToken: number;
  onInsertSql: (sql: string) => void;
}

export function TablesNavigationPage({ provider, refreshToken, onInsertSql }: TablesNavigationPageProps) {
  return (
    <main className="workspace page-workspace navigation-page-workspace">
      <section className="navigation-page">
        <header className="navigation-page-heading">
          <span><Table2 size={15} aria-hidden="true" /></span>
          <div>
            <p className="eyebrow">Tables</p>
            <h2>Database Tables</h2>
          </div>
        </header>
        <div className="navigation-page-panel">
          <SchemaExplorer provider={provider} refreshToken={refreshToken} onInsertSql={onInsertSql} />
        </div>
      </section>
    </main>
  );
}

interface ScriptsNavigationPageProps {
  atomic: boolean;
  stopOnError: boolean;
  onAtomicChange: (value: boolean) => void;
  onLoadScript: (sql: string) => void;
  onStopOnErrorChange: (value: boolean) => void;
}

export function ScriptsNavigationPage({
  atomic,
  stopOnError,
  onAtomicChange,
  onLoadScript,
  onStopOnErrorChange
}: ScriptsNavigationPageProps) {
  return (
    <main className="workspace page-workspace navigation-page-workspace">
      <section className="navigation-page">
        <header className="navigation-page-heading">
          <span><FileCode2 size={15} aria-hidden="true" /></span>
          <div>
            <p className="eyebrow">Scripts</p>
            <h2>Script Runner</h2>
          </div>
        </header>
        <div className="navigation-page-grid">
          <section className="navigation-page-panel">
            <h3>Execution Options</h3>
            <ScriptExecutionOptions
              atomic={atomic}
              stopOnError={stopOnError}
              onAtomicChange={onAtomicChange}
              onStopOnErrorChange={onStopOnErrorChange}
            />
          </section>
          <section className="navigation-page-panel">
            <h3>Starter Scripts</h3>
            <div className="starter-script-list">
              <button type="button" onClick={() => onLoadScript("BEGIN;\nUPDATE employees SET salary = salary + 1000 WHERE name = 'Amira';\nCOMMIT;")}>
                Transaction raise
              </button>
              <button type="button" onClick={() => onLoadScript("BEGIN;\nUPDATE employees SET salary = 1 WHERE name = 'Amira';\nROLLBACK;\nSELECT name, salary FROM employees WHERE name = 'Amira';")}>
                Rollback demo
              </button>
              <button type="button" onClick={() => onLoadScript("INSERT INTO employees VALUES (9, 'bad@example.com', 'Bad', 999, 1, TRUE);")}>
                Constraint error
              </button>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

interface ConsoleNavigationHintProps {
  onFocusConsole: () => void;
}

export function ConsoleNavigationHint({ onFocusConsole }: ConsoleNavigationHintProps) {
  return (
    <button className="console-route-pill" type="button" onClick={onFocusConsole}>
      <TerminalSquare size={13} aria-hidden="true" />
      Console
    </button>
  );
}
