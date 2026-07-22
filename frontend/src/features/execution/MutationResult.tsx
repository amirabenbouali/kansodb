import type { MutationExecutionView } from "./executionTypes";

interface MutationResultProps {
  result: MutationExecutionView;
}

export function MutationResult({ result }: MutationResultProps) {
  return (
    <div className="result-card is-success">
      <strong>{mutationMessage(result)}</strong>
      <span>{result.tableName} · {result.durationMs.toFixed(1)} ms</span>
    </div>
  );
}

function mutationMessage(result: MutationExecutionView): string {
  const noun = result.affectedRows === 1 ? "row" : "rows";
  const verb = result.operation === "insert" ? "inserted" : result.operation === "update" ? "updated" : "deleted";
  return `${result.affectedRows} ${noun} ${verb}`;
}
