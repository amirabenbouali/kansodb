import type { KansoErrorView } from "../execution/executionTypes";
import { ErrorMetadata } from "./ErrorMetadata";
import { ErrorSuggestion } from "./ErrorSuggestion";

interface ErrorPanelProps {
  error: KansoErrorView;
  sourceSql?: string | undefined;
  statementNumber?: number | undefined;
}

export function ErrorPanel({ error, sourceSql, statementNumber }: ErrorPanelProps) {
  return (
    <div className="execution-error" role="alert">
      <div className="error-heading">
        <strong>{error.code}</strong>
        {statementNumber === undefined ? null : <span>Statement {statementNumber}</span>}
      </div>
      <p>{error.message}</p>
      <ErrorMetadata error={error} />
      <ErrorSuggestion error={error} />
      {sourceSql !== undefined && sourceSql.trim().length > 0 ? <code>{sourceSql}</code> : null}
      {error.metadata === undefined ? null : (
        <details>
          <summary>Developer details</summary>
          <pre>{JSON.stringify(error.metadata, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
