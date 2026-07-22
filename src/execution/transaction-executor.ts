import type {
  BeginTransactionStatement,
  CommitTransactionStatement,
  RollbackTransactionStatement
} from "../parser/ast.js";
import type { Database } from "../storage/database.js";
import type { TransactionResult } from "./statement-result.js";

export type TransactionStatement =
  | BeginTransactionStatement
  | CommitTransactionStatement
  | RollbackTransactionStatement;

export class TransactionExecutor {
  public execute(statement: TransactionStatement, database: Database): TransactionResult {
    switch (statement.type) {
      case "begin_transaction":
        database.transactionManager.begin();
        return {
          type: "transaction",
          action: "BEGIN",
          state: database.transactionState
        };
      case "commit_transaction":
        database.transactionManager.commit();
        return {
          type: "transaction",
          action: "COMMIT",
          state: database.transactionState
        };
      case "rollback_transaction":
        database.transactionManager.rollback();
        return {
          type: "transaction",
          action: "ROLLBACK",
          state: database.transactionState
        };
    }
  }
}
