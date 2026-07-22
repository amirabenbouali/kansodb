import type { TransactionExecutionView } from "./executionTypes";

interface TransactionResultProps {
  result: TransactionExecutionView;
}

export function TransactionResult({ result }: TransactionResultProps) {
  return (
    <div className="result-card">
      <strong>{transactionMessage(result.action)}</strong>
      <span>State: {result.state} · {result.durationMs.toFixed(1)} ms</span>
    </div>
  );
}

function transactionMessage(action: TransactionExecutionView["action"]): string {
  switch (action) {
    case "BEGIN":
      return "Transaction started";
    case "COMMIT":
      return "Transaction committed";
    case "ROLLBACK":
      return "Transaction rolled back";
  }
}
