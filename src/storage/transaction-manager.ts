import { TransactionError } from "../errors/transaction-error.js";
import type { Database } from "./database.js";
import type { TransactionAction, TransactionSnapshot, TransactionState } from "./transaction.js";

export class TransactionManager {
  private readonly database: Database;
  private activeSnapshot: TransactionSnapshot | undefined;

  public constructor(database: Database) {
    this.database = database;
  }

  public get state(): TransactionState {
    return this.activeSnapshot === undefined ? "IDLE" : "ACTIVE";
  }

  public get isActive(): boolean {
    return this.activeSnapshot !== undefined;
  }

  public begin(): void {
    if (this.activeSnapshot !== undefined) {
      this.throwError("TRANSACTION_ALREADY_ACTIVE", "A transaction is already active.", "BEGIN");
    }

    try {
      this.activeSnapshot = this.database.createSnapshot();
    } catch (error) {
      if (error instanceof TransactionError) {
        throw error;
      }

      throw new TransactionError({
        code: "TRANSACTION_SNAPSHOT_FAILED",
        message: "Failed to create transaction snapshot.",
        currentState: this.state,
        attemptedAction: "BEGIN"
      });
    }
  }

  public commit(): void {
    if (this.activeSnapshot === undefined) {
      this.throwError("NO_ACTIVE_TRANSACTION", "No transaction is active.", "COMMIT");
    }

    this.activeSnapshot = undefined;
  }

  public rollback(): void {
    if (this.activeSnapshot === undefined) {
      this.throwError("NO_ACTIVE_TRANSACTION", "No transaction is active.", "ROLLBACK");
    }

    const snapshot = this.activeSnapshot;

    try {
      this.database.restoreSnapshot(snapshot);
      this.activeSnapshot = undefined;
    } catch (error) {
      if (error instanceof TransactionError) {
        throw error;
      }

      throw new TransactionError({
        code: "TRANSACTION_RESTORE_FAILED",
        message: "Failed to restore transaction snapshot.",
        currentState: this.state,
        attemptedAction: "ROLLBACK"
      });
    }
  }

  public createInternalSnapshot(): TransactionSnapshot {
    try {
      return this.database.createSnapshot();
    } catch {
      throw new TransactionError({
        code: "TRANSACTION_SNAPSHOT_FAILED",
        message: "Failed to create transaction snapshot.",
        currentState: this.state
      });
    }
  }

  public restoreInternalSnapshot(snapshot: TransactionSnapshot): void {
    try {
      this.database.restoreSnapshot(snapshot);
    } catch {
      throw new TransactionError({
        code: "TRANSACTION_RESTORE_FAILED",
        message: "Failed to restore transaction snapshot.",
        currentState: this.state
      });
    }
  }

  private throwError(code: "TRANSACTION_ALREADY_ACTIVE" | "NO_ACTIVE_TRANSACTION", message: string, attemptedAction: TransactionAction): never {
    throw new TransactionError({
      code,
      message,
      currentState: this.state,
      attemptedAction
    });
  }
}
