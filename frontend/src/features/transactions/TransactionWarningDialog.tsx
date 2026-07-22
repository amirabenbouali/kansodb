import { useEffect, useRef } from "react";

interface TransactionWarningDialogProps {
  actionLabel: string;
  open: boolean;
  onCancel: () => void;
  onRollback: () => void;
}

export function TransactionWarningDialog({ actionLabel, open, onCancel, onRollback }: TransactionWarningDialogProps) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (open) {
      cancelRef.current?.focus();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        aria-labelledby="transaction-warning-title"
        aria-modal="true"
        className="dialog-card transaction-warning"
        role="dialog"
      >
        <h2 id="transaction-warning-title">Transaction still active</h2>
        <p>
          {actionLabel} would leave uncommitted changes behind. Roll back the active transaction first, or cancel and keep working.
        </p>
        <div className="dialog-actions">
          <button ref={cancelRef} type="button" onClick={onCancel}>Cancel</button>
          <button className="danger-button" type="button" onClick={onRollback}>Rollback</button>
        </div>
      </section>
    </div>
  );
}
