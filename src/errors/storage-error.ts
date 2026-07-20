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
  | "TYPE_MISMATCH"
  | "INVALID_NUMBER";

export interface StorageErrorOptions {
  code: StorageErrorCode;
  message: string;
  tableName?: string;
  columnName?: string;
  value?: DatabaseValue | undefined;
}

export class StorageError extends Error {
  public readonly code: StorageErrorCode;
  public readonly tableName?: string;
  public readonly columnName?: string;
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

    if ("value" in options) {
      this.value = options.value;
    }
  }
}
