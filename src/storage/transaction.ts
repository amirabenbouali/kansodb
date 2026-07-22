import type { StoredColumnDefinition } from "./column.js";
import type { ForeignKeyMetadata } from "./foreign-key.js";
import type { StoredRow } from "./row.js";
import type { PrimaryKeyMetadata, UniqueConstraintMetadata } from "./constraint.js";

export type TransactionState = "IDLE" | "ACTIVE";
export type TransactionAction = "BEGIN" | "COMMIT" | "ROLLBACK";

export interface TableSnapshot {
  name: string;
  columns: readonly Readonly<StoredColumnDefinition>[];
  primaryKey?: PrimaryKeyMetadata;
  uniqueConstraints: readonly UniqueConstraintMetadata[];
  foreignKeys: readonly ForeignKeyMetadata[];
  rows: readonly Readonly<StoredRow>[];
}

export interface DatabaseSnapshot {
  tables: readonly TableSnapshot[];
}

export type TransactionSnapshot = DatabaseSnapshot;

export function cloneDatabaseSnapshot(snapshot: DatabaseSnapshot): DatabaseSnapshot {
  return freezeDatabaseSnapshot({
    tables: snapshot.tables.map((table) => ({
      name: table.name,
      columns: table.columns.map((column) => ({
        ...column,
        ...(column.references === undefined ? {} : { references: { ...column.references } })
      })),
      ...(table.primaryKey === undefined ? {} : { primaryKey: { ...table.primaryKey } }),
      uniqueConstraints: table.uniqueConstraints.map((constraint) => ({ ...constraint })),
      foreignKeys: table.foreignKeys.map((foreignKey) => ({ ...foreignKey })),
      rows: table.rows.map((row) => ({ ...row }))
    }))
  });
}

export function freezeDatabaseSnapshot(snapshot: DatabaseSnapshot): DatabaseSnapshot {
  for (const table of snapshot.tables) {
    for (const column of table.columns) {
      if (column.references !== undefined) {
        Object.freeze(column.references);
      }
      Object.freeze(column);
    }

    if (table.primaryKey !== undefined) {
      Object.freeze(table.primaryKey);
    }

    for (const constraint of table.uniqueConstraints) {
      Object.freeze(constraint);
    }

    for (const foreignKey of table.foreignKeys) {
      Object.freeze(foreignKey);
    }

    for (const row of table.rows) {
      Object.freeze(row);
    }

    Object.freeze(table.columns);
    Object.freeze(table.uniqueConstraints);
    Object.freeze(table.foreignKeys);
    Object.freeze(table.rows);
    Object.freeze(table);
  }

  Object.freeze(snapshot.tables);
  return Object.freeze(snapshot);
}
