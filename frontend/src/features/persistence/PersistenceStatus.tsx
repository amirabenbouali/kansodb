import { Database, HardDrive, Save } from "lucide-react";
import type { PersistenceStateView, TransactionStateView } from "../../engine/KansoClient";

interface PersistenceStatusProps {
  persistence: PersistenceStateView;
  transactionState: TransactionStateView;
}

export function PersistenceStatus({ persistence, transactionState }: PersistenceStatusProps) {
  const persistent = persistence.storageKind === "browser-file";
  const saveText = persistence.lastSavedAt === null ? "Not saved yet" : `Saved ${formatRelativeTime(persistence.lastSavedAt)}`;

  return (
    <section className="persistence-status" aria-label="Persistence status">
      <div className="persistence-heading">
        {persistent ? <HardDrive size={15} aria-hidden="true" /> : <Database size={15} aria-hidden="true" />}
        <strong>{persistence.databaseName}</strong>
      </div>
      <span>{persistent ? "Browser file-backed" : "In-memory"}</span>
      <span className={persistence.dirty ? "dirty-state is-dirty" : "dirty-state"}>
        {persistence.dirty ? "Unsaved changes" : "Clean"}
      </span>
      <span>{saveText}</span>
      {persistence.lastSavedBytes === null ? null : (
        <span><Save size={13} aria-hidden="true" /> {persistence.lastSavedBytes.toLocaleString()} bytes</span>
      )}
      {transactionState === "ACTIVE" ? <em>Save is locked while a transaction is active.</em> : null}
    </section>
  );
}

function formatRelativeTime(value: string): string {
  const savedAt = Date.parse(value);
  if (Number.isNaN(savedAt)) {
    return value;
  }

  const seconds = Math.max(0, Math.round((Date.now() - savedAt) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m ago`;
}
