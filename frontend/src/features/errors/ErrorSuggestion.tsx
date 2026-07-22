import type { KansoErrorView } from "../execution/executionTypes";

interface ErrorSuggestionProps {
  error: KansoErrorView;
}

export function ErrorSuggestion({ error }: ErrorSuggestionProps) {
  const suggestion = suggestionFor(error);
  if (suggestion === null) {
    return null;
  }

  return (
    <div className="error-suggestion">
      <strong>Suggestion</strong>
      <p>{suggestion}</p>
    </div>
  );
}

function suggestionFor(error: KansoErrorView): string | null {
  switch (error.code) {
    case "FOREIGN_KEY_VIOLATION":
      return foreignKeySuggestion(error);
    case "PRIMARY_KEY_VIOLATION":
      return "Use a primary-key value that does not already exist, or update the existing row instead of inserting a duplicate.";
    case "UNIQUE_CONSTRAINT_VIOLATION":
      return "Use a value that is unique for this column, or update the existing row that already has this value.";
    case "NOT_NULL_VIOLATION":
    case "NULL_CONSTRAINT":
      return "Provide a non-NULL value for the required column.";
    case "TABLE_NOT_FOUND":
      return "Check the table name in the schema explorer and rerun the statement.";
    case "COLUMN_NOT_FOUND":
      return "Check the column name and table qualifier against the schema explorer.";
    case "PARSER_ERROR":
      return "Check the SQL near the reported position and rerun the statement.";
    case "LEXER_ERROR":
      return "Remove or escape the unexpected character near the reported position.";
    default:
      return null;
  }
}

function foreignKeySuggestion(error: KansoErrorView): string {
  const metadata = error.metadata ?? {};
  const tableName = stringMetadata(metadata.tableName) ?? "the referencing table";
  const columnName = stringMetadata(metadata.columnName) ?? "the foreign-key column";
  const referencedTable = stringMetadata(metadata.referencedTableName) ?? "the referenced table";
  const referencedColumn = stringMetadata(metadata.referencedColumnName) ?? "the referenced column";
  const value = metadata.value === undefined ? "the inserted value" : formatValue(metadata.value);

  return `${tableName}.${columnName} references ${referencedTable}.${referencedColumn}, but no matching row exists for value ${value}. Insert the referenced row first or use an existing referenced value.`;
}

function stringMetadata(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function formatValue(value: unknown): string {
  if (value === null) {
    return "NULL";
  }

  return String(value);
}
