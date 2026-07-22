import type { ExecutionOperatorView } from "../../engine/tracing/traceTypes";

interface OperatorNodeProps {
  node: ExecutionOperatorView;
}

export function OperatorNode({ node }: OperatorNodeProps) {
  return (
    <article className={`trace-operator is-${node.kind}`}>
      <div>
        <strong>{node.label}</strong>
        {node.detail === undefined ? null : <span>{node.detail}</span>}
      </div>
      <dl>
        {node.tableName === undefined ? null : (
          <div>
            <dt>Table</dt>
            <dd>{node.tableName}</dd>
          </div>
        )}
        {node.inputRows === undefined ? null : (
          <div>
            <dt>Input</dt>
            <dd>{node.inputRows}</dd>
          </div>
        )}
        {node.outputRows === undefined ? null : (
          <div>
            <dt>Output</dt>
            <dd>{node.outputRows}</dd>
          </div>
        )}
      </dl>
      {node.children === undefined || node.children.length === 0 ? null : (
        <div className="trace-operator-children">
          {node.children.map((child) => <OperatorNode key={child.id} node={child} />)}
        </div>
      )}
    </article>
  );
}
