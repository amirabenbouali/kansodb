import type { PersistenceStateView, TransactionStateView } from "../../engine/KansoClient";

interface StatusBarProps {
  databaseName: string;
  engineState: string;
  mode: string;
  persistence: PersistenceStateView;
  transactionState: TransactionStateView;
  version: string;
}

export function StatusBar({ databaseName, engineState, mode, persistence, transactionState, version }: StatusBarProps) {
  return (
    <footer className="status-bar">
      <span>
        Database: {databaseName}
        <i className="mode-dot" aria-hidden="true" />
      </span>
      <span>
        Engine: {engineState}
        <i className="mode-dot" aria-hidden="true" />
      </span>
      <span>{transactionState === "ACTIVE" ? "Transaction: active" : "Transaction: inactive"}</span>
      <span>{persistence.storageKind === "browser-file" ? "Browser file" : "Memory"} · {persistence.dirty ? "unsaved" : "clean"}</span>
      <span>Version: {version}</span>
      <span>{mode}</span>
    </footer>
  );
}
