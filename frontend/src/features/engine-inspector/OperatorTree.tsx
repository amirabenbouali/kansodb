import type { ExecutionOperatorView } from "../../engine/tracing/traceTypes";
import { OperatorNode } from "./OperatorNode";

interface OperatorTreeProps {
  operators: readonly ExecutionOperatorView[] | undefined;
}

export function OperatorTree({ operators }: OperatorTreeProps) {
  if (operators === undefined || operators.length === 0) {
    return <p className="trace-note">No executor operators are available for this statement.</p>;
  }

  return (
    <div className="operator-tree">
      <div className="trace-content-heading">
        <h3>Executor Operators</h3>
        <span>{operators.length} root nodes</span>
      </div>
      {operators.map((operator) => <OperatorNode key={operator.id} node={operator} />)}
    </div>
  );
}
