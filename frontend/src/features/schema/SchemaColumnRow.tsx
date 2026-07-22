import { CornerDownRight } from "lucide-react";
import type { ColumnSchemaView } from "./schemaTypes";

interface SchemaColumnRowProps {
  column: ColumnSchemaView;
  onInsertColumn: (columnName: string) => void;
  onRevealForeignKey: (tableName: string) => void;
}

export function SchemaColumnRow({ column, onInsertColumn, onRevealForeignKey }: SchemaColumnRowProps) {
  const foreignKey = column.foreignKey;

  return (
    <div className="schema-column-row">
      <button
        className="schema-name-button column-name-button"
        type="button"
        onClick={() => onInsertColumn(column.name)}
        title={`Insert column ${column.name}`}
      >
        {column.name}
      </button>
      <span className="schema-type">{column.dataType}</span>
      <span className="schema-badges" aria-label={`Constraints for ${column.name}`}>
        {column.primaryKey ? <ConstraintBadge label="Primary key" text="PK" /> : null}
        {foreignKey !== undefined ? <ConstraintBadge label="Foreign key" text="FK" /> : null}
        {column.unique && !column.primaryKey ? <ConstraintBadge label="Unique constraint" text="UQ" /> : null}
        <span className={column.nullable ? "nullable-badge" : "nullable-badge is-required"}>
          {column.nullable ? "NULL" : "NOT NULL"}
        </span>
      </span>
      {foreignKey !== undefined ? (
        <button
          className="foreign-key-link"
          type="button"
          onClick={() => onRevealForeignKey(foreignKey.tableName)}
          aria-label={`Reveal referenced table ${foreignKey.tableName}`}
        >
          <CornerDownRight size={13} aria-hidden="true" />
          {foreignKey.tableName}.{foreignKey.columnName}
        </button>
      ) : null}
    </div>
  );
}

interface ConstraintBadgeProps {
  label: string;
  text: string;
}

function ConstraintBadge({ label, text }: ConstraintBadgeProps) {
  return (
    <span className="constraint-badge" aria-label={label}>
      {text}
    </span>
  );
}
