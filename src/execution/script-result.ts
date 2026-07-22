import type { Statement } from "../parser/ast.js";
import type { DatabaseValue } from "../storage/row.js";
import type { StatementResult } from "./statement-result.js";

export interface ScriptExecutionOptions {
  stopOnError?: boolean;
}

export interface ScriptExecutionResult {
  type: "script";
  statements: StatementExecutionRecord[];
  statementCount: number;
  succeeded: number;
  failed: number;
  completed: boolean;
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
    completed: result.completed,
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

  return clone;
}
