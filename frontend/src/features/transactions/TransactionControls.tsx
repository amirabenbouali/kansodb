import { GitCommitHorizontal, RotateCcw, SquarePen } from "lucide-react";
import type { TransactionStateView } from "../../engine/KansoClient";

interface TransactionControlsProps {
  disabled: boolean;
  state: TransactionStateView;
  onBegin: () => void;
  onCommit: () => void;
  onRollback: () => void;
}

export function TransactionControls({ disabled, state, onBegin, onCommit, onRollback }: TransactionControlsProps) {
  const active = state === "ACTIVE";

  return (
    <section className="transaction-controls" aria-label="Transaction controls">
      <div>
        <span>Transaction</span>
        <strong>{active ? "Active" : "Inactive"}</strong>
      </div>
      <div className="transaction-actions">
        <button type="button" disabled={disabled || active} onClick={onBegin} aria-label="Begin transaction">
          <SquarePen size={14} aria-hidden="true" />
          Begin
        </button>
        <button type="button" disabled={disabled || !active} onClick={onCommit} aria-label="Commit transaction">
          <GitCommitHorizontal size={14} aria-hidden="true" />
          Commit
        </button>
        <button type="button" disabled={disabled || !active} onClick={onRollback} aria-label="Rollback transaction">
          <RotateCcw size={14} aria-hidden="true" />
          Rollback
        </button>
      </div>
    </section>
  );
}
