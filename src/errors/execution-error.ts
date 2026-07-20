import type { DatabaseValue } from "../storage/row.js";

export type ExecutionErrorCode =
  | "TABLE_NOT_FOUND"
  | "TABLE_ALREADY_EXISTS"
  | "COLUMN_NOT_FOUND"
  | "DUPLICATE_COLUMN"
  | "COLUMN_VALUE_COUNT_MISMATCH"
  | "VALUE_COUNT_MISMATCH"
  | "INVALID_COMPARISON"
  | "TYPE_MISMATCH"
  | "NULL_CONSTRAINT"
  | "INVALID_LIMIT"
  | "INVALID_STATEMENT"
  | "UNSUPPORTED_STATEMENT";

export interface ExecutionErrorOptions {
  code: ExecutionErrorCode;
  message: string;
  tableName?: string;
  columnName?: string;
  operator?: string;
  value?: DatabaseValue | undefined;
}

export class ExecutionError extends Error {
  public readonly code: ExecutionErrorCode;
  public readonly tableName?: string;
  public readonly columnName?: string;
  public readonly operator?: string;
  public readonly value?: DatabaseValue | undefined;

  public constructor(options: ExecutionErrorOptions) {
    super(options.message);
    this.name = "ExecutionError";
    this.code = options.code;

    if (options.tableName !== undefined) {
      this.tableName = options.tableName;
    }

    if (options.columnName !== undefined) {
      this.columnName = options.columnName;
    }

    if (options.operator !== undefined) {
      this.operator = options.operator;
    }

    if ("value" in options) {
      this.value = options.value;
    }
  }
}
