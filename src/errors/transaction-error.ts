import type { Statement } from "../parser/ast.js";
import type { TransactionAction, TransactionState } from "../storage/transaction.js";

export type TransactionErrorCode =
  | "TRANSACTION_ALREADY_ACTIVE"
  | "NO_ACTIVE_TRANSACTION"
  | "NESTED_TRANSACTION_NOT_SUPPORTED"
  | "ATOMIC_SCRIPT_IN_ACTIVE_TRANSACTION"
  | "TRANSACTION_CONTROL_NOT_ALLOWED"
  | "TRANSACTION_SNAPSHOT_FAILED"
  | "TRANSACTION_RESTORE_FAILED"
  | "INVALID_TRANSACTION_STATE";

export interface TransactionErrorOptions {
  code: TransactionErrorCode;
  message: string;
  currentState?: TransactionState;
  attemptedAction?: TransactionAction;
  atomic?: boolean;
  statementType?: Statement["type"];
}

export class TransactionError extends Error {
  public readonly code: TransactionErrorCode;
  public readonly currentState?: TransactionState;
  public readonly attemptedAction?: TransactionAction;
  public readonly atomic?: boolean;
  public readonly statementType?: Statement["type"];

  public constructor(options: TransactionErrorOptions) {
    super(options.message);
    this.name = "TransactionError";
    this.code = options.code;

    if (options.currentState !== undefined) {
      this.currentState = options.currentState;
    }

    if (options.attemptedAction !== undefined) {
      this.attemptedAction = options.attemptedAction;
    }

    if (options.atomic !== undefined) {
      this.atomic = options.atomic;
    }

    if (options.statementType !== undefined) {
      this.statementType = options.statementType;
    }
  }
}
