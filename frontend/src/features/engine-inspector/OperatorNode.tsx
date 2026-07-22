import type { ExecutionOperatorView } from "../../engine/tracing/traceTypes";

interface OperatorNodeProps {
  node: ExecutionOperatorView;
}

export function OperatorNode({ node }: OperatorNodeProps) {
  const hasMetrics = node.tableName !== undefined || node.inputRows !== undefined || node.outputRows !== undefined;
  const children = node.children ?? [];
  const hasChildren = children.length > 0;
  const className = [
    "trace-operator",
    `is-${node.kind}`,
    hasMetrics ? "has-metrics" : "is-structural",
    hasChildren ? "has-children" : "is-leaf"
  ].join(" ");

  return (
    <article className={className}>
      <div>
        <strong title={node.label}>{node.label}</strong>
        {node.detail === undefined ? null : <span title={node.detail}>{node.detail}</span>}
      </div>
      {hasMetrics ? (
        <dl>
          {node.tableName === undefined ? null : (
            <div>
              <dt>Table</dt>
              <dd title={node.tableName}>{node.tableName}</dd>
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
      ) : null}
      {!hasChildren ? null : (
        <div className="trace-operator-children">
          {children.map((child) => <OperatorNode key={child.id} node={child} />)}
        </div>
      )}
    </article>
  );
}
