import { ScriptError, type ScriptErrorCode } from "../errors/script-error.js";
import { LexerError } from "../errors/lexer-error.js";
import { ParserError } from "../errors/parser-error.js";
import { StorageError } from "../errors/storage-error.js";
import { ExecutionError } from "../errors/execution-error.js";
import { Lexer } from "../lexer/lexer.js";
import { ScriptParser, type ParsedScriptStatement } from "../parser/script-parser.js";
import type { Database } from "../storage/database.js";
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
    const startedAt = performance.now();

    let parsedStatements: ParsedScriptStatement[];
    try {
      const tokens = new Lexer(sql).tokenize();
      parsedStatements = new ScriptParser(tokens, sql).parseWithMetadata();
    } catch (error) {
      const result = this.buildParseFailureResult(error, startedAt);
      this.history?.add(result);
      return cloneScriptExecutionResult(result);
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

    const result = this.buildResult(records, parsedStatements.length, !stopped, startedAt);
    this.history?.add(result);
    return cloneScriptExecutionResult(result);
  }

  private buildParseFailureResult(error: unknown, scriptStartedAt: number): ScriptExecutionResult {
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
      completed: false,
      durationMs: this.durationSince(scriptStartedAt)
    };

    return result;
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
    scriptStartedAt: number
  ): ScriptExecutionResult {
    const succeeded = records.filter((record) => record.status === "success").length;
    const failed = records.filter((record) => record.status === "error").length;

    return {
      type: "script",
      statements: records,
      statementCount,
      succeeded,
      failed,
      completed,
      durationMs: this.durationSince(scriptStartedAt)
    };
  }

  private normalizeError(error: unknown, overrideCode?: ScriptErrorCode): ScriptExecutionErrorRecord {
    if (error instanceof LexerError || error instanceof ParserError) {
      return this.knownPositionError(error, overrideCode);
    }

    if (error instanceof ExecutionError || error instanceof StorageError || error instanceof ScriptError) {
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

  private knownCodeError(error: ExecutionError | StorageError | ScriptError, overrideCode?: ScriptErrorCode): ScriptExecutionErrorRecord {
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

    return record;
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
