import type { SchemaExecutionView } from "./executionTypes";

interface SchemaResultProps {
  result: SchemaExecutionView;
}

export function SchemaResult({ result }: SchemaResultProps) {
  return (
    <div className="result-card is-success">
      <strong>Created table {result.tableName}</strong>
      <span>
        {result.columnCount} columns · {result.constraints.primaryKeys} PK · {result.constraints.unique} UQ · {result.constraints.foreignKeys} FK
      </span>
    </div>
  );
}
