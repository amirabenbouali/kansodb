import type { ScriptExecutionErrorRecord, ScriptExecutionResult, StatementExecutionRecord } from "../../../src/execution/script-result.ts";
import type { StatementResult } from "../../../src/execution/statement-result.ts";
import type { Database } from "../../../src/storage/database.ts";
import type { DatabaseValue } from "../../../src/storage/row.ts";
import type { DatabaseSchemaView } from "../features/schema/schemaTypes";
import type {
  KansoErrorView,
  KansoExecutionResult,
  KansoResultRow,
  KansoScriptExecutionResult,
  KansoScriptStatementView
} from "../features/execution/executionTypes";

export function mapStatementResult(result: StatementResult, database: Database, durationMs: number): KansoExecutionResult {
  switch (result.type) {
    case "query":
      return {
        type: "query",
        columns: [...result.columns],
        rows: result.rows.map(cloneRow),
        rowCount: result.rowCount,
        durationMs
      };
    case "insert":
    case "update":
    case "delete":
      return {
        type: "mutation",
        operation: result.type,
        tableName: result.tableName,
        affectedRows: result.affectedRows,
        durationMs
      };
    case "create_table":
      return {
        type: "schema",
        operation: "create_table",
        tableName: result.tableName,
        columnCount: result.columnCount,
        constraints: summarizeConstraints(database, result.tableName),
        durationMs
      };
    case "transaction":
      return {
        type: "transaction",
        action: result.action,
        state: result.state,
        durationMs
      };
    case "persistence":
      return {
        type: "persistence",
        action: "SAVE",
        path: result.path,
        bytesWritten: result.bytesWritten,
        durationMs
      };
  }
}

export function mapScriptResult(result: ScriptExecutionResult, database: Database): KansoScriptExecutionResult {
  return {
    type: "script",
    statements: result.statements.map((record) => mapScriptRecord(record, database)),
    statementCount: result.statementCount,
    succeeded: result.succeeded,
    failed: result.failed,
    skipped: result.skipped,
    completed: result.completed,
    atomic: result.atomic,
    committed: result.committed,
    rolledBack: result.rolledBack,
    durationMs: result.durationMs
  };
}

export function mapDatabaseSchema(database: Database, databaseName: string): DatabaseSchemaView {
  const snapshot = database.createSnapshot();

  return {
    databaseName,
    tables: snapshot.tables.map((table) => ({
      name: table.name,
      rowCount: table.rows.length,
      columns: table.columns.map((column) => ({
        name: column.name,
        dataType: column.type,
        nullable: column.nullable,
        primaryKey: column.primaryKey,
        unique: column.unique,
        ...(column.references === undefined
          ? {}
          : {
            foreignKey: {
              tableName: column.references.tableName,
              columnName: column.references.columnName
            }
          })
      }))
    }))
  };
}

function mapScriptRecord(record: StatementExecutionRecord, database: Database): KansoScriptStatementView {
  const mappedResult = record.result === undefined
    ? undefined
    : mapStatementResult(record.result, database, record.durationMs);
  const error = record.error === undefined ? undefined : mapScriptError(record.error);

  return {
    index: record.index,
    sql: record.sql ?? "",
    status: record.status,
    resultType: mappedResult?.type ?? "none",
    ...(mappedResult === undefined ? {} : { result: mappedResult }),
    ...(error === undefined ? {} : { error }),
    durationMs: record.durationMs
  };
}

function mapScriptError(error: ScriptExecutionErrorRecord): KansoErrorView {
  const metadata: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(error)) {
    if (key !== "name" && key !== "code" && key !== "message" && value !== undefined) {
      metadata[key] = value;
    }
  }

  const view: KansoErrorView = {
    code: error.code ?? error.name,
    message: error.message
  };

  return Object.keys(metadata).length === 0 ? view : { ...view, metadata };
}

function summarizeConstraints(database: Database, tableName: string) {
  const table = database.getTable(tableName);
  const columns = table.getSchema();

  return {
    primaryKeys: columns.filter((column) => column.primaryKey).length,
    unique: columns.filter((column) => column.unique).length,
    foreignKeys: columns.filter((column) => column.references !== undefined).length,
    nullable: columns.filter((column) => column.nullable).length
  };
}

function cloneRow(row: Record<string, DatabaseValue>): KansoResultRow {
  return { ...row };
}
