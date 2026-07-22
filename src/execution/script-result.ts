import type { Statement } from "../parser/ast.js";
import type { DatabaseValue } from "../storage/row.js";
import type { TransactionAction, TransactionState } from "../storage/transaction.js";
import type { StatementResult } from "./statement-result.js";

export interface ScriptExecutionOptions {
  stopOnError?: boolean;
  atomic?: boolean;
}

export interface ScriptExecutionResult {
  type: "script";
  statements: StatementExecutionRecord[];
  statementCount: number;
  succeeded: number;
  failed: number;
  skipped: number;
  completed: boolean;
  atomic: boolean;
  committed: boolean;
  rolledBack: boolean;
  durationMs: number;
}

export interface StatementExecutionRecord {
  index: number;
  statementType: Statement["type"] | null;
  sql?: string;
  status: "success" | "error" | "skipped";
  result?: StatementResult;
  error?: ScriptExecutionErrorRecord;
  durationMs: number;
  startedAt: string;
  finishedAt: string;
}

export interface ScriptExecutionErrorRecord {
  name: string;
  code?: string;
  message: string;
  tableName?: string;
  columnName?: string;
  referencedTableName?: string;
  referencedColumnName?: string;
  referencingTableName?: string;
  referencingColumnName?: string;
  value?: DatabaseValue | undefined;
  currentState?: TransactionState;
  attemptedAction?: TransactionAction;
  atomic?: boolean;
  statementType?: Statement["type"];
  path?: string;
  foundVersion?: number;
  supportedVersions?: readonly number[];
  databaseStateCommitted?: boolean;
  persistenceSucceeded?: boolean;
  position?: {
    start: number;
    end: number;
  };
}

export class ExecutionHistory {
  private readonly records: ScriptExecutionResult[] = [];

  public add(record: ScriptExecutionResult): void {
    this.records.push(cloneScriptExecutionResult(record));
  }

  public list(): ScriptExecutionResult[] {
    return this.records.map(cloneScriptExecutionResult);
  }

  public latest(): ScriptExecutionResult | undefined {
    const latest = this.records.at(-1);
    return latest === undefined ? undefined : cloneScriptExecutionResult(latest);
  }

  public clear(): void {
    this.records.length = 0;
  }
}

export function cloneScriptExecutionResult(result: ScriptExecutionResult): ScriptExecutionResult {
  return {
    type: "script",
    statementCount: result.statementCount,
    succeeded: result.succeeded,
    failed: result.failed,
    skipped: result.skipped,
    completed: result.completed,
    atomic: result.atomic,
    committed: result.committed,
    rolledBack: result.rolledBack,
    durationMs: result.durationMs,
    statements: result.statements.map(cloneStatementExecutionRecord)
  };
}

function cloneStatementExecutionRecord(record: StatementExecutionRecord): StatementExecutionRecord {
  const clone: StatementExecutionRecord = {
    index: record.index,
    statementType: record.statementType,
    status: record.status,
    durationMs: record.durationMs,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt
  };

  if (record.sql !== undefined) {
    clone.sql = record.sql;
  }

  if (record.result !== undefined) {
    clone.result = cloneStatementResult(record.result);
  }

  if (record.error !== undefined) {
    clone.error = cloneErrorRecord(record.error);
  }

  return clone;
}

function cloneStatementResult(result: StatementResult): StatementResult {
  switch (result.type) {
    case "query":
      return {
        type: "query",
        columns: [...result.columns],
        rows: result.rows.map((row) => ({ ...row })),
        rowCount: result.rowCount
      };
    case "create_table":
      return { ...result };
    case "insert":
      return { ...result };
    case "update":
      return { ...result };
    case "delete":
      return { ...result };
    case "transaction":
      return { ...result };
    case "persistence":
      return { ...result };
  }
}

function cloneErrorRecord(error: ScriptExecutionErrorRecord): ScriptExecutionErrorRecord {
  const clone: ScriptExecutionErrorRecord = {
    name: error.name,
    message: error.message
  };

  if (error.code !== undefined) {
    clone.code = error.code;
  }

  if (error.position !== undefined) {
    clone.position = { ...error.position };
  }

  if (error.tableName !== undefined) {
    clone.tableName = error.tableName;
  }

  if (error.columnName !== undefined) {
    clone.columnName = error.columnName;
  }

  if (error.referencedTableName !== undefined) {
    clone.referencedTableName = error.referencedTableName;
  }

  if (error.referencedColumnName !== undefined) {
    clone.referencedColumnName = error.referencedColumnName;
  }

  if (error.referencingTableName !== undefined) {
    clone.referencingTableName = error.referencingTableName;
  }

  if (error.referencingColumnName !== undefined) {
    clone.referencingColumnName = error.referencingColumnName;
  }

  if ("value" in error) {
    clone.value = error.value;
  }

  if (error.currentState !== undefined) {
    clone.currentState = error.currentState;
  }

  if (error.attemptedAction !== undefined) {
    clone.attemptedAction = error.attemptedAction;
  }

  if (error.atomic !== undefined) {
    clone.atomic = error.atomic;
  }

  if (error.statementType !== undefined) {
    clone.statementType = error.statementType;
  }

  if (error.path !== undefined) {
    clone.path = error.path;
  }

  if (error.foundVersion !== undefined) {
    clone.foundVersion = error.foundVersion;
  }

  if (error.supportedVersions !== undefined) {
    clone.supportedVersions = [...error.supportedVersions];
  }

  if (error.databaseStateCommitted !== undefined) {
    clone.databaseStateCommitted = error.databaseStateCommitted;
  }

  if (error.persistenceSucceeded !== undefined) {
    clone.persistenceSucceeded = error.persistenceSucceeded;
  }

  return clone;
}
