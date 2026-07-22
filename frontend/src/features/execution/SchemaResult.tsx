import type { SchemaExecutionView } from "./executionTypes";

interface SchemaResultProps {
  result: SchemaExecutionView;
  transactionActive: boolean;
}

export function SchemaResult({ result, transactionActive }: SchemaResultProps) {
  return (
    <div className={transactionActive ? "result-card is-success is-uncommitted" : "result-card is-success"}>
      <strong>Created table {result.tableName}</strong>
      <span>
        {result.columnCount} columns · {result.constraints.primaryKeys} PK · {result.constraints.unique} UQ · {result.constraints.foreignKeys} FK
      </span>
      {transactionActive ? <em>Schema change is visible in this session until commit or rollback.</em> : null}
    </div>
  );
}
