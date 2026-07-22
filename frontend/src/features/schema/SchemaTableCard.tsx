import { ChevronRight, FilePlus2 } from "lucide-react";
import { SchemaColumnRow } from "./SchemaColumnRow";
import type { TableSchemaView } from "./schemaTypes";

interface SchemaTableCardProps {
  expanded: boolean;
  highlighted: boolean;
  onInsertColumn: (columnName: string) => void;
  onInsertStarterQuery: (tableName: string) => void;
  onInsertTable: (tableName: string) => void;
  onRevealForeignKey: (tableName: string) => void;
  onToggle: () => void;
  table: TableSchemaView;
}

export function SchemaTableCard({
  expanded,
  highlighted,
  onInsertColumn,
  onInsertStarterQuery,
  onInsertTable,
  onRevealForeignKey,
  onToggle,
  table
}: SchemaTableCardProps) {
  return (
    <article className={highlighted ? "schema-table-card is-highlighted" : "schema-table-card"}>
      <header className="schema-table-header">
        <button
          className="schema-table-disclosure"
          type="button"
          aria-expanded={expanded}
          aria-controls={`schema-table-${table.name}`}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${table.name}`}
          onClick={onToggle}
        >
          <ChevronRight className={expanded ? "disclosure-icon is-open" : "disclosure-icon"} size={15} aria-hidden="true" />
        </button>
        <button
          className="schema-name-button schema-table-title"
          type="button"
          onClick={() => onInsertTable(table.name)}
          title={`Insert table ${table.name}`}
        >
          {table.name}
        </button>
        <button
          className="schema-table-name-action"
          type="button"
          onClick={() => onInsertTable(table.name)}
          title={`Insert table ${table.name}`}
        >
          {table.rowCount} rows
        </button>
        <button
          className="schema-starter-query-button"
          type="button"
          onClick={() => onInsertStarterQuery(table.name)}
          aria-label={`Insert starter query for ${table.name}`}
        >
          <FilePlus2 size={14} aria-hidden="true" />
        </button>
      </header>

      {expanded ? (
        <div className="schema-column-stack" id={`schema-table-${table.name}`}>
          {table.columns.map((column) => (
            <SchemaColumnRow
              column={column}
              key={column.name}
              onInsertColumn={onInsertColumn}
              onRevealForeignKey={onRevealForeignKey}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}
