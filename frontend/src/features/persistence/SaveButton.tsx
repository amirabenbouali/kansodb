import { Save } from "lucide-react";
import type { PersistenceStateView, TransactionStateView } from "../../engine/KansoClient";

interface SaveButtonProps {
  persistence: PersistenceStateView;
  running: boolean;
  transactionState: TransactionStateView;
  onSave: () => void;
}

export function SaveButton({ persistence, running, transactionState, onSave }: SaveButtonProps) {
  const disabledReason = disabledSaveReason(persistence, transactionState);
  const disabled = running || disabledReason !== null;

  return (
    <button
      className="save-database-button"
      type="button"
      disabled={disabled}
      title={disabledReason ?? "Save database"}
      onClick={onSave}
    >
      <Save size={14} aria-hidden="true" />
      Save DB
    </button>
  );
}

function disabledSaveReason(persistence: PersistenceStateView, transactionState: TransactionStateView): string | null {
  if (persistence.path === null) {
    return "No persistence destination exists for this database.";
  }

  if (transactionState === "ACTIVE") {
    return "Cannot save while a transaction is active.";
  }

  return null;
}
