import type { MutationExecutionView } from "./executionTypes";

interface MutationResultProps {
  result: MutationExecutionView;
  transactionActive: boolean;
}

export function MutationResult({ result, transactionActive }: MutationResultProps) {
  return (
    <div className={transactionActive ? "result-card is-success is-uncommitted" : "result-card is-success"}>
      <strong>{mutationMessage(result)}</strong>
      <span>{result.tableName} · {result.durationMs.toFixed(1)} ms</span>
      {transactionActive ? <em>Visible in this session until commit or rollback.</em> : null}
    </div>
  );
}

function mutationMessage(result: MutationExecutionView): string {
  const noun = result.affectedRows === 1 ? "row" : "rows";
  const verb = result.operation === "insert" ? "inserted" : result.operation === "update" ? "updated" : "deleted";
  return `${result.affectedRows} ${noun} ${verb}`;
}
