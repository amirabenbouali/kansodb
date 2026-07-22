import type { KansoErrorView } from "./executionTypes";

interface ExecutionErrorProps {
  error: KansoErrorView;
  sourceSql?: string | undefined;
}

export function ExecutionError({ error, sourceSql }: ExecutionErrorProps) {
  return (
    <div className="execution-error" role="alert">
      <strong>{error.code}</strong>
      <p>{error.message}</p>
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
