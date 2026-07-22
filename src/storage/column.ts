import { StorageError } from "../errors/storage-error.js";
import type { DataType } from "./data-type.js";
import type { ForeignKeyReference } from "./foreign-key.js";

export interface ColumnDefinition {
  name: string;
  type: DataType;
  nullable?: boolean;
  unique?: boolean;
  primaryKey?: boolean;
  references?: ForeignKeyReference;
}

export interface StoredColumnDefinition {
  name: string;
  type: DataType;
  nullable: boolean;
  unique: boolean;
  primaryKey: boolean;
  references?: ForeignKeyReference;
}

export function normalizeColumnDefinitions(columns: readonly ColumnDefinition[], tableName: string): StoredColumnDefinition[] {
  const seen = new Set<string>();

  return columns.map((column) => {
    const trimmedName = column.name.trim();

    if (trimmedName.length === 0) {
      throw new StorageError({
        code: "INVALID_COLUMN_NAME",
        message: "Column name must not be empty",
        tableName,
        columnName: column.name
      });
    }

    const key = normalizeColumnName(column.name);
    if (seen.has(key)) {
      throw new StorageError({
        code: "DUPLICATE_COLUMN",
        message: `Duplicate column "${column.name}" in table "${tableName}"`,
        tableName,
        columnName: column.name
      });
    }

    seen.add(key);

    return {
      name: column.name,
      type: column.type,
      nullable: column.primaryKey === true ? false : column.nullable ?? false,
      unique: column.primaryKey === true ? true : column.unique ?? false,
      primaryKey: column.primaryKey ?? false,
      ...(column.references === undefined ? {} : { references: { ...column.references } })
    };
  });
}

export function normalizeColumnName(name: string): string {
  return name.toLowerCase();
}
