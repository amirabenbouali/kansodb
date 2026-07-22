import { ScriptError, type ScriptErrorCode } from "../errors/script-error.js";
import { LexerError } from "../errors/lexer-error.js";
import { ParserError } from "../errors/parser-error.js";
import { StorageError } from "../errors/storage-error.js";
import { ExecutionError } from "../errors/execution-error.js";
import { TransactionError } from "../errors/transaction-error.js";
import { Lexer } from "../lexer/lexer.js";
import { ScriptParser, type ParsedScriptStatement } from "../parser/script-parser.js";
import type { Database } from "../storage/database.js";
import type { TransactionSnapshot } from "../storage/transaction.js";
import { Executor } from "./executor.js";
import {
  cloneScriptExecutionResult,
  ExecutionHistory,
  type ScriptExecutionErrorRecord,
  type ScriptExecutionOptions,
  type ScriptExecutionResult,
  type StatementExecutionRecord
} from "./script-result.js";

export class ScriptExecutor {
  private readonly database: Database;
  private readonly history: ExecutionHistory | undefined;

  public constructor(database: Database, history?: ExecutionHistory) {
    this.database = database;
    this.history = history;
  }

  public execute(sql: string, options: ScriptExecutionOptions = {}): ScriptExecutionResult {
    const stopOnError = options.stopOnError ?? true;
    const atomic = options.atomic ?? false;
    const startedAt = performance.now();

    if (atomic && this.database.isTransactionActive) {
      const result = this.buildSingleFailureResult(
        new TransactionError({
          code: "ATOMIC_SCRIPT_IN_ACTIVE_TRANSACTION",
          message: "Cannot execute an atomic script while an explicit transaction is active.",
          currentState: this.database.transactionState,
          atomic: true
        }),
        startedAt,
        atomic,
        false,
        true
      );
      this.history?.add(result);
      return cloneScriptExecutionResult(result);
    }

    const atomicSnapshot = atomic ? this.database.transactionManager.createInternalSnapshot() : undefined;

    let parsedStatements: ParsedScriptStatement[];
    try {
      const tokens = new Lexer(sql).tokenize();
      parsedStatements = new ScriptParser(tokens, sql).parseWithMetadata();
    } catch (error) {
      if (atomicSnapshot !== undefined) {
        this.database.transactionManager.restoreInternalSnapshot(atomicSnapshot);
      }

      const result = this.buildParseFailureResult(error, startedAt, atomic, false, atomic);
      this.history?.add(result);
      return cloneScriptExecutionResult(result);
    }

    if (atomic) {
      const transactionStatement = parsedStatements.find((entry) => this.isTransactionStatement(entry.statement.type));
      if (transactionStatement !== undefined) {
        if (atomicSnapshot !== undefined) {
          this.database.transactionManager.restoreInternalSnapshot(atomicSnapshot);
        }

        const result = this.buildTransactionControlFailureResult(parsedStatements, transactionStatement, startedAt, stopOnError);
        this.history?.add(result);
        return cloneScriptExecutionResult(result);
      }
    }

    const records: StatementExecutionRecord[] = [];
    const executor = new Executor(this.database);
    let stopped = false;

    parsedStatements.forEach((entry, index) => {
      if (stopped) {
        records.push(this.createSkippedRecord(index, entry));
        return;
      }

      const recordStartedAt = performance.now();
      const wallStartedAt = new Date().toISOString();

      try {
        const result = executor.execute(entry.statement);
        records.push({
          index,
          statementType: entry.statement.type,
          ...(entry.sql === undefined ? {} : { sql: entry.sql }),
          status: "success",
          result,
          durationMs: this.durationSince(recordStartedAt),
          startedAt: wallStartedAt,
          finishedAt: new Date().toISOString()
        });
      } catch (error) {
        records.push({
          index,
          statementType: entry.statement.type,
          ...(entry.sql === undefined ? {} : { sql: entry.sql }),
          status: "error",
          error: this.normalizeError(error),
          durationMs: this.durationSince(recordStartedAt),
          startedAt: wallStartedAt,
          finishedAt: new Date().toISOString()
        });

        if (stopOnError) {
          stopped = true;
        }
      }
    });

    const failed = records.some((record) => record.status === "error");
    let committed = false;
    let rolledBack = false;

    if (atomic && atomicSnapshot !== undefined) {
      if (failed) {
        this.database.transactionManager.restoreInternalSnapshot(atomicSnapshot);
        rolledBack = true;
      } else {
        committed = true;
      }
    }

    const result = this.buildResult(records, parsedStatements.length, !stopped, startedAt, atomic, committed, rolledBack);
    this.history?.add(result);
    return cloneScriptExecutionResult(result);
  }

  private buildParseFailureResult(
    error: unknown,
    scriptStartedAt: number,
    atomic: boolean,
    committed: boolean,
    rolledBack: boolean
  ): ScriptExecutionResult {
    const now = new Date().toISOString();
    const errorRecord = this.normalizeError(error, this.scriptErrorCode(error));

    const result: ScriptExecutionResult = {
      type: "script",
      statements: [
        {
          index: 0,
          statementType: null,
          status: "error",
          error: errorRecord,
          durationMs: this.durationSince(scriptStartedAt),
          startedAt: now,
          finishedAt: now
        }
      ],
      statementCount: 0,
      succeeded: 0,
      failed: 1,
      skipped: 0,
      completed: false,
      atomic,
      committed,
      rolledBack,
      durationMs: this.durationSince(scriptStartedAt)
    };

    return result;
  }

  private buildSingleFailureResult(
    error: unknown,
    scriptStartedAt: number,
    atomic: boolean,
    committed: boolean,
    rolledBack: boolean
  ): ScriptExecutionResult {
    const now = new Date().toISOString();
    return {
      type: "script",
      statements: [
        {
          index: 0,
          statementType: null,
          status: "error",
          error: this.normalizeError(error),
          durationMs: this.durationSince(scriptStartedAt),
          startedAt: now,
          finishedAt: now
        }
      ],
      statementCount: 0,
      succeeded: 0,
      failed: 1,
      skipped: 0,
      completed: false,
      atomic,
      committed,
      rolledBack,
      durationMs: this.durationSince(scriptStartedAt)
    };
  }

  private buildTransactionControlFailureResult(
    parsedStatements: ParsedScriptStatement[],
    transactionStatement: ParsedScriptStatement,
    scriptStartedAt: number,
    stopOnError: boolean
  ): ScriptExecutionResult {
    const records: StatementExecutionRecord[] = [];
    let blocked = false;

    parsedStatements.forEach((entry, index) => {
      const now = new Date().toISOString();

      if (blocked) {
        records.push(this.createSkippedRecord(index, entry));
        return;
      }

      if (entry === transactionStatement || this.isTransactionStatement(entry.statement.type)) {
        records.push({
          index,
          statementType: entry.statement.type,
          ...(entry.sql === undefined ? {} : { sql: entry.sql }),
          status: "error",
          error: this.normalizeError(new TransactionError({
            code: "TRANSACTION_CONTROL_NOT_ALLOWED",
            message: "Explicit transaction statements are not allowed in an atomic script.",
            currentState: this.database.transactionState,
            atomic: true,
            statementType: entry.statement.type
          })),
          durationMs: 0,
          startedAt: now,
          finishedAt: now
        });

        if (stopOnError) {
          blocked = true;
        }
        return;
      }

      records.push(this.createSkippedRecord(index, entry));
    });

    return this.buildResult(records, parsedStatements.length, false, scriptStartedAt, true, false, true);
  }

  private createSkippedRecord(index: number, entry: ParsedScriptStatement): StatementExecutionRecord {
    const now = new Date().toISOString();

    return {
      index,
      statementType: entry.statement.type,
      ...(entry.sql === undefined ? {} : { sql: entry.sql }),
      status: "skipped",
      durationMs: 0,
      startedAt: now,
      finishedAt: now
    };
  }

  private buildResult(
    records: StatementExecutionRecord[],
    statementCount: number,
    completed: boolean,
    scriptStartedAt: number,
    atomic: boolean,
    committed: boolean,
    rolledBack: boolean
  ): ScriptExecutionResult {
    const succeeded = records.filter((record) => record.status === "success").length;
    const failed = records.filter((record) => record.status === "error").length;
    const skipped = records.filter((record) => record.status === "skipped").length;

    return {
      type: "script",
      statements: records,
      statementCount,
      succeeded,
      failed,
      skipped,
      completed,
      atomic,
      committed,
      rolledBack,
      durationMs: this.durationSince(scriptStartedAt)
    };
  }

  private normalizeError(error: unknown, overrideCode?: ScriptErrorCode): ScriptExecutionErrorRecord {
    if (error instanceof LexerError || error instanceof ParserError) {
      return this.knownPositionError(error, overrideCode);
    }

    if (error instanceof ExecutionError || error instanceof StorageError || error instanceof ScriptError || error instanceof TransactionError) {
      return this.knownCodeError(error, overrideCode);
    }

    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message
      };
    }

    return {
      name: "UnknownError",
      message: "An unknown error occurred."
    };
  }

  private knownPositionError(error: LexerError | ParserError, overrideCode?: ScriptErrorCode): ScriptExecutionErrorRecord {
    const start = error instanceof LexerError ? error.position : error.start;
    const end = error instanceof LexerError ? error.position : error.end;

    const record: ScriptExecutionErrorRecord = {
      name: error.name,
      message: error.message,
      position: {
        start,
        end
      }
    };

    if (overrideCode !== undefined) {
      record.code = overrideCode;
    }

    return record;
  }

  private knownCodeError(error: ExecutionError | StorageError | ScriptError | TransactionError, overrideCode?: ScriptErrorCode): ScriptExecutionErrorRecord {
    const record: ScriptExecutionErrorRecord = {
      name: error.name,
      code: overrideCode ?? error.code,
      message: error.message
    };

    if ("start" in error && typeof error.start === "number" && "end" in error && typeof error.end === "number") {
      record.position = {
        start: error.start,
        end: error.end
      };
    }

    if ("tableName" in error && typeof error.tableName === "string") {
      record.tableName = error.tableName;
    }

    if ("columnName" in error && typeof error.columnName === "string") {
      record.columnName = error.columnName;
    }

    if ("referencedTableName" in error && typeof error.referencedTableName === "string") {
      record.referencedTableName = error.referencedTableName;
    }

    if ("referencedColumnName" in error && typeof error.referencedColumnName === "string") {
      record.referencedColumnName = error.referencedColumnName;
    }

    if ("referencingTableName" in error && typeof error.referencingTableName === "string") {
      record.referencingTableName = error.referencingTableName;
    }

    if ("referencingColumnName" in error && typeof error.referencingColumnName === "string") {
      record.referencingColumnName = error.referencingColumnName;
    }

    if ("value" in error) {
      record.value = error.value;
    }

    if ("currentState" in error && typeof error.currentState === "string") {
      record.currentState = error.currentState;
    }

    if ("attemptedAction" in error && typeof error.attemptedAction === "string") {
      record.attemptedAction = error.attemptedAction;
    }

    if ("atomic" in error && typeof error.atomic === "boolean") {
      record.atomic = error.atomic;
    }

    if ("statementType" in error && typeof error.statementType === "string") {
      record.statementType = error.statementType;
    }

    return record;
  }

  private isTransactionStatement(type: ParsedScriptStatement["statement"]["type"]): boolean {
    return type === "begin_transaction" || type === "commit_transaction" || type === "rollback_transaction";
  }

  private scriptErrorCode(error: unknown): ScriptErrorCode {
    if (error instanceof LexerError) {
      return "LEX_ERROR";
    }

    if (error instanceof ParserError) {
      return "PARSE_ERROR";
    }

    return "INVALID_SCRIPT";
  }

  private durationSince(startedAt: number): number {
    return Math.max(0, performance.now() - startedAt);
  }
}

export function executeSqlScript(database: Database, sql: string, options?: ScriptExecutionOptions): ScriptExecutionResult {
  return new ScriptExecutor(database).execute(sql, options);
}
