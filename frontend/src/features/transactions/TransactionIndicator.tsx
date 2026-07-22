import type { TransactionStateView } from "../../engine/KansoClient";

interface TransactionIndicatorProps {
  state: TransactionStateView;
}

export function TransactionIndicator({ state }: TransactionIndicatorProps) {
  const active = state === "ACTIVE";

  return (
    <div className={active ? "transaction-indicator is-active" : "transaction-indicator"} role="status">
      <span aria-hidden="true" />
      <strong>{active ? "Transaction active" : "Transaction inactive"}</strong>
      {active ? <em>Uncommitted changes are visible in this database session.</em> : null}
    </div>
  );
}
