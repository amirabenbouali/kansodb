import type { DatabaseValue } from "../storage/row.js";

export type ExecutionErrorCode =
  | "TABLE_NOT_FOUND"
  | "TABLE_ALREADY_EXISTS"
  | "COLUMN_NOT_FOUND"
  | "DUPLICATE_COLUMN"
  | "DUPLICATE_ALIAS"
  | "AMBIGUOUS_COLUMN"
  | "RELATION_NOT_FOUND"
  | "DUPLICATE_RELATION"
  | "INVALID_JOIN"
  | "INVALID_JOIN_CONDITION"
  | "INVALID_JOIN_TYPE"
  | "COLUMN_VALUE_COUNT_MISMATCH"
  | "VALUE_COUNT_MISMATCH"
  | "INVALID_COMPARISON"
  | "INVALID_AGGREGATE_ARGUMENT"
  | "INVALID_AGGREGATE_TYPE"
  | "INVALID_GROUPING"
  | "INVALID_ORDER_BY"
  | "INVALID_NULL_ORDER"
  | "ORDER_BY_POSITION_OUT_OF_RANGE"
  | "RESULT_ALIAS_NOT_FOUND"
  | "WILDCARD_NOT_ALLOWED"
  | "UNSUPPORTED_EXPRESSION"
  | "INVALID_EXPRESSION"
  | "INVALID_PREDICATE"
  | "INVALID_NULL_PREDICATE"
  | "UNSUPPORTED_PREDICATE"
  | "INVALID_OPERAND_TYPE"
  | "INVALID_ARITHMETIC"
  | "DIVISION_BY_ZERO"
  | "MODULO_BY_ZERO"
  | "NON_FINITE_RESULT"
  | "INVALID_AGGREGATE_PLACEMENT"
  | "TYPE_MISMATCH"
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
  | "INVALID_ASSIGNMENT"
  | "INVALID_LIMIT"
  | "INVALID_STATEMENT"
  | "UNSUPPORTED_STATEMENT";

export interface ExecutionErrorOptions {
  code: ExecutionErrorCode;
  message: string;
  tableName?: string;
  columnName?: string;
  referencedTableName?: string;
  referencedColumnName?: string;
  referencingTableName?: string;
  referencingColumnName?: string;
  operator?: string;
  value?: DatabaseValue | undefined;
}

export class ExecutionError extends Error {
  public readonly code: ExecutionErrorCode;
  public readonly tableName?: string;
  public readonly columnName?: string;
  public readonly referencedTableName?: string;
  public readonly referencedColumnName?: string;
  public readonly referencingTableName?: string;
  public readonly referencingColumnName?: string;
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

    if (options.operator !== undefined) {
      this.operator = options.operator;
    }

    if ("value" in options) {
      this.value = options.value;
    }
  }
}
