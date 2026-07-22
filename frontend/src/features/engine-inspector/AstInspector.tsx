import { ChevronRight } from "lucide-react";
import type { CSSProperties } from "react";
import { useState } from "react";
import type { AstTraceView } from "../../engine/tracing/traceTypes";

interface AstInspectorProps {
  ast: AstTraceView | undefined;
}

export function AstInspector({ ast }: AstInspectorProps) {
  if (ast === undefined) {
    return <p className="trace-note">No AST is available for this execution.</p>;
  }

  return (
    <div className="ast-inspector">
      <div className="trace-content-heading">
        <h3>Abstract Syntax Tree</h3>
        <span>{ast.type}</span>
      </div>
      <AstNode node={ast} depth={0} />
    </div>
  );
}

function AstNode({ node, depth }: { node: AstTraceView; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;

  return (
    <article className="ast-node" style={{ "--depth": depth } as CSSProperties}>
      <button className="ast-node-header" type="button" onClick={() => setExpanded((current) => !current)}>
        <ChevronRight className={expanded ? "is-open" : undefined} size={14} aria-hidden="true" />
        <strong>{node.label}</strong>
        <span>{node.type}</span>
      </button>
      {expanded ? (
        <div className="ast-node-body">
          {node.properties.length > 0 ? (
            <dl>
              {node.properties.map((property) => (
                <div key={property.key}>
                  <dt>{property.key}</dt>
                  <dd>{String(property.value)}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {node.truncated ? <p className="trace-note">Tree truncated for safety.</p> : null}
          {hasChildren ? node.children.map((child) => <AstNode key={child.id} node={child} depth={depth + 1} />) : null}
        </div>
      ) : null}
    </article>
  );
}
