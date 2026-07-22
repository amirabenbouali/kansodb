import type { DatabaseValue } from "../storage/row.js";

export type StorageErrorCode =
  | "INVALID_TABLE_NAME"
  | "TABLE_ALREADY_EXISTS"
  | "TABLE_NOT_FOUND"
  | "INVALID_COLUMN_NAME"
  | "DUPLICATE_COLUMN"
  | "MISSING_COLUMN"
  | "UNKNOWN_COLUMN"
  | "NULL_CONSTRAINT"
  | "NOT_NULL_VIOLATION"
  | "PRIMARY_KEY_VIOLATION"
  | "UNIQUE_CONSTRAINT_VIOLATION"
  | "FOREIGN_KEY_VIOLATION"
  | "REFERENCED_ROW_EXISTS"
  | "DUPLICATE_PRIMARY_KEY"
  | "DUPLICATE_CONSTRAINT"
  | "INVALID_CONSTRAINT"
  | "CONSTRAINT_COLUMN_NOT_FOUND"
  | "REFERENCED_TABLE_NOT_FOUND"
  | "REFERENCED_COLUMN_NOT_FOUND"
  | "REFERENCED_COLUMN_NOT_UNIQUE"
  | "FOREIGN_KEY_TYPE_MISMATCH"
  | "MULTIPLE_PRIMARY_KEYS"
  | "UNSUPPORTED_COMPOSITE_KEY"
  | "UNSUPPORTED_CONSTRAINT"
  | "TYPE_MISMATCH"
  | "INVALID_NUMBER";

export interface StorageErrorOptions {
  code: StorageErrorCode;
  message: string;
  tableName?: string;
  columnName?: string;
  referencedTableName?: string;
  referencedColumnName?: string;
  referencingTableName?: string;
  referencingColumnName?: string;
  value?: DatabaseValue | undefined;
}

export class StorageError extends Error {
  public readonly code: StorageErrorCode;
  public readonly tableName?: string;
  public readonly columnName?: string;
  public readonly referencedTableName?: string;
  public readonly referencedColumnName?: string;
  public readonly referencingTableName?: string;
  public readonly referencingColumnName?: string;
  public readonly value?: DatabaseValue | undefined;

  public constructor(options: StorageErrorOptions) {
    super(options.message);
    this.name = "StorageError";
    this.code = options.code;

    if (options.tableName !== undefined) {
      this.tableName = options.tableName;
    }

    if (options.columnName !== undefined) {
      this.columnName = options.columnName;
    }

    if (options.referencedTableName !== undefined) {
      this.referencedTableName = options.referencedTableName;
    }

    if (options.referencedColumnName !== undefined) {
      this.referencedColumnName = options.referencedColumnName;
    }

    if (options.referencingTableName !== undefined) {
      this.referencingTableName = options.referencingTableName;
    }

    if (options.referencingColumnName !== undefined) {
      this.referencingColumnName = options.referencingColumnName;
    }

    if ("value" in options) {
      this.value = options.value;
    }
  }
}
