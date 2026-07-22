import { BookOpen, Database, FolderOpen, Plus } from "lucide-react";
import { exampleDatabaseDescription } from "./sampleWorkspace";

interface WelcomeScreenProps {
  onLearn: () => void;
  onLoadExample: () => void;
  onNewMemory: () => void;
  onOpenDatabase: () => void;
}

export function WelcomeScreen({ onLearn, onLoadExample, onNewMemory, onOpenDatabase }: WelcomeScreenProps) {
  return (
    <main className="welcome-screen" aria-labelledby="welcome-title">
      <section className="welcome-panel">
        <p className="eyebrow">KansoDB Workbench</p>
        <h1 id="welcome-title">Understand every step of a SQL query.</h1>
        <p>
          Start with an empty in-memory database, open a browser-backed database, or load the bundled demo workspace when you want something real to inspect.
        </p>
        <div className="welcome-actions">
          <button className="primary-button" type="button" onClick={onLoadExample}>
            <Database size={16} aria-hidden="true" />
            Open Demo Workspace
          </button>
          <button type="button" onClick={onNewMemory}>
            <Plus size={16} aria-hidden="true" />
            New in-memory database
          </button>
          <button type="button" onClick={onOpenDatabase}>
            <FolderOpen size={16} aria-hidden="true" />
            Open database
          </button>
          <button type="button" onClick={onLearn}>
            <BookOpen size={16} aria-hidden="true" />
            Learn how KansoDB works
          </button>
        </div>
        <aside className="welcome-example">
          <strong>KansoDB Sample Workspace</strong>
          <span>{exampleDatabaseDescription}</span>
        </aside>
      </section>
    </main>
  );
}
