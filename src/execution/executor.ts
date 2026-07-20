import { ExecutionError, type ExecutionErrorOptions } from "../errors/execution-error.js";
import { StorageError } from "../errors/storage-error.js";
import { Lexer } from "../lexer/lexer.js";
import { Parser } from "../parser/parser.js";
import type {
  CreateColumnDataType,
  CreateTableStatement,
  InsertStatement,
  SelectColumn,
  SelectStatement,
  Statement
} from "../parser/ast.js";
import type { ColumnDefinition } from "../storage/column.js";
import type { Database } from "../storage/database.js";
import { DataType } from "../storage/data-type.js";
import type { DatabaseValue, InputRow, StoredRow } from "../storage/row.js";
import type { Table } from "../storage/table.js";
import { evaluateExpression } from "./expression-evaluator.js";
import type { QueryResult } from "./query-result.js";
import type { CreateTableResult, InsertResult, StatementResult } from "./statement-result.js";

interface ResolvedColumn {
  queryName: string;
  schemaName: string;
}

interface IndexedRow {
  row: StoredRow;
  index: number;
}

export class Executor {
  private readonly database: Database;

  public constructor(database: Database) {
    this.database = database;
  }

  public execute(statement: SelectStatement): QueryResult;
  public execute(statement: CreateTableStatement): CreateTableResult;
  public execute(statement: InsertStatement): InsertResult;
  public execute(statement: Statement): StatementResult;
  public execute(statement: Statement): StatementResult {
    switch (statement.type) {
      case "select":
        return this.executeSelect(statement);
      case "create_table":
        return this.executeCreateTable(statement);
      case "insert":
        return this.executeInsert(statement);
    }

    return this.assertNever(statement);
  }

  private executeSelect(statement: SelectStatement): QueryResult {
    const table = this.resolveTable(statement.from.name);
    const selectedColumns = this.resolveSelectedColumns(statement.columns, table);

    if (statement.where !== undefined) {
      this.validateExpressionColumns(statement.where, table);
    }

    const orderByColumn = statement.orderBy === undefined ? undefined : this.resolveColumn(statement.orderBy.column, table).schemaName;

    if (statement.limit !== undefined) {
      this.validateLimit(statement.limit);
    }

    let rows = table.getRows();

    if (statement.where !== undefined) {
      rows = rows.filter((row) => evaluateExpression(statement.where!, row, table));
    }

    if (statement.orderBy !== undefined && orderByColumn !== undefined) {
      rows = this.sortRows(rows, orderByColumn, statement.orderBy.direction);
    }

    if (statement.limit !== undefined) {
      rows = rows.slice(0, statement.limit);
    }

    const resultRows = rows.map((row) => this.projectRow(row, selectedColumns));
    return {
      type: "query",
      columns: selectedColumns.map((column) => column.schemaName),
      rows: resultRows,
      rowCount: resultRows.length
    };
  }

  private executeCreateTable(statement: CreateTableStatement): CreateTableResult {
    const columns = statement.columns.map((column): ColumnDefinition => ({
      name: column.name,
      type: this.mapDataType(column.dataType),
      nullable: column.nullable
    }));

    try {
      this.database.createTable(statement.tableName, columns);
    } catch (error) {
      this.throwExecutionErrorFromStorage(error);
    }

    return {
      type: "create_table",
      tableName: statement.tableName,
      columnCount: statement.columns.length
    };
  }

  private executeInsert(statement: InsertStatement): InsertResult {
    const table = this.resolveTable(statement.tableName);
    const row = statement.columns === undefined ? this.buildPositionalInsertRow(statement, table) : this.buildNamedInsertRow(statement, table);

    try {
      table.insert(row);
    } catch (error) {
      this.throwExecutionErrorFromStorage(error);
    }

    return {
      type: "insert",
      tableName: table.name,
      affectedRows: 1
    };
  }

  private resolveTable(name: string): Table {
    try {
      return this.database.getTable(name);
    } catch {
      throw new ExecutionError({
        code: "TABLE_NOT_FOUND",
        message: `Table "${name}" was not found`,
        tableName: name
      });
    }
  }

  private resolveSelectedColumns(columns: readonly SelectColumn[], table: Table): ResolvedColumn[] {
    if (columns.length === 1 && columns[0]?.type === "wildcard") {
      return table.getSchema().map((column) => ({
        queryName: column.name,
        schemaName: column.name
      }));
    }

    const seen = new Set<string>();
    return columns.map((column) => {
      if (column.type === "wildcard") {
        throw new ExecutionError({
          code: "UNSUPPORTED_STATEMENT",
          message: "Wildcard selection cannot be mixed with named columns",
          tableName: table.name
        });
      }

      const resolved = this.resolveColumn(column.name, table);
      const key = resolved.schemaName.toLowerCase();

      if (seen.has(key)) {
        throw new ExecutionError({
          code: "DUPLICATE_COLUMN",
          message: `Duplicate selected column "${column.name}"`,
          tableName: table.name,
          columnName: column.name
        });
      }

      seen.add(key);
      return resolved;
    });
  }

  private buildPositionalInsertRow(statement: InsertStatement, table: Table): InputRow {
    const schema = table.getSchema();

    if (statement.values.length !== schema.length) {
      throw new ExecutionError({
        code: "VALUE_COUNT_MISMATCH",
        message: `INSERT provided ${statement.values.length} values for table "${table.name}", which has ${schema.length} columns.`,
        tableName: table.name
      });
    }

    const row: InputRow = {};
    schema.forEach((column, index) => {
      row[column.name] = statement.values[index]!.value;
    });

    return row;
  }

  private buildNamedInsertRow(statement: InsertStatement, table: Table): InputRow {
    const columns = statement.columns ?? [];

    if (columns.length !== statement.values.length) {
      throw new ExecutionError({
        code: "COLUMN_VALUE_COUNT_MISMATCH",
        message: `INSERT specified ${columns.length} columns but provided ${statement.values.length} values.`,
        tableName: table.name
      });
    }

    const seen = new Set<string>();
    const row: InputRow = {};

    columns.forEach((columnName, index) => {
      const resolved = this.resolveColumn(columnName, table);
      const key = resolved.schemaName.toLowerCase();

      if (seen.has(key)) {
        throw new ExecutionError({
          code: "DUPLICATE_COLUMN",
          message: `Duplicate INSERT column "${columnName}"`,
          tableName: table.name,
          columnName
        });
      }

      seen.add(key);
      row[resolved.schemaName] = statement.values[index]!.value;
    });

    return row;
  }

  private resolveColumn(name: string, table: Table): ResolvedColumn {
    try {
      const column = table.getColumn(name);
      return {
        queryName: name,
        schemaName: column.name
      };
    } catch {
      throw new ExecutionError({
        code: "COLUMN_NOT_FOUND",
        message: `Column "${name}" was not found in table "${table.name}"`,
        tableName: table.name,
        columnName: name
      });
    }
  }

  private validateExpressionColumns(expression: SelectStatement["where"], table: Table): void {
    if (expression === undefined) {
      return;
    }

    if (expression.type === "comparison") {
      this.resolveColumn(expression.left.name, table);
      return;
    }

    this.validateExpressionColumns(expression.left, table);
    this.validateExpressionColumns(expression.right, table);
  }

  private validateLimit(limit: number): void {
    if (!Number.isInteger(limit) || limit < 0) {
      throw new ExecutionError({
        code: "INVALID_LIMIT",
        message: `LIMIT must be a non-negative integer, received ${String(limit)}`,
        value: limit
      });
    }
  }

  private sortRows(rows: readonly StoredRow[], columnName: string, direction: "ASC" | "DESC"): StoredRow[] {
    return rows
      .map((row, index): IndexedRow => ({ row, index }))
      .sort((left, right) => {
        const leftValue = left.row[columnName] ?? null;
        const rightValue = right.row[columnName] ?? null;

        if (leftValue === null || rightValue === null) {
          const comparison = this.compareNullsLast(leftValue, rightValue);

          if (comparison !== 0) {
            return comparison;
          }
        }

        const comparison = this.compareNonNullSortValues(leftValue, rightValue);

        if (comparison === 0) {
          return left.index - right.index;
        }

        return direction === "ASC" ? comparison : -comparison;
      })
      .map((entry) => entry.row);
  }

  private compareNullsLast(left: DatabaseValue, right: DatabaseValue): number {
    if (left === null && right === null) {
      return 0;
    }

    if (left === null) {
      return 1;
    }

    if (right === null) {
      return -1;
    }

    return 0;
  }

  private compareNonNullSortValues(left: DatabaseValue, right: DatabaseValue): number {
    if (left === null || right === null) {
      return 0;
    }

    if (typeof left === "boolean" && typeof right === "boolean") {
      return Number(left) - Number(right);
    }

    if (typeof left === "number" && typeof right === "number") {
      return left - right;
    }

    if (typeof left === "string" && typeof right === "string") {
      return left.localeCompare(right);
    }

    throw new ExecutionError({
      code: "TYPE_MISMATCH",
      message: `Cannot sort mixed value types ${typeof left} and ${typeof right}`
    });
  }

  private projectRow(row: StoredRow, columns: readonly ResolvedColumn[]): Record<string, DatabaseValue> {
    const projected: Record<string, DatabaseValue> = {};

    for (const column of columns) {
      projected[column.schemaName] = row[column.schemaName] ?? null;
    }

    return projected;
  }

  private mapDataType(dataType: CreateColumnDataType): DataType {
    switch (dataType) {
      case "INTEGER":
        return DataType.INTEGER;
      case "DECIMAL":
        return DataType.DECIMAL;
      case "TEXT":
        return DataType.TEXT;
      case "BOOLEAN":
        return DataType.BOOLEAN;
    }
  }

  private throwExecutionErrorFromStorage(error: unknown): never {
    if (!(error instanceof StorageError)) {
      throw error;
    }

    const options: ExecutionErrorOptions = {
      code: this.mapStorageErrorCode(error.code),
      message: error.message
    };

    if (error.tableName !== undefined) {
      options.tableName = error.tableName;
    }

    if (error.columnName !== undefined) {
      options.columnName = error.columnName;
    }

    if ("value" in error) {
      options.value = error.value;
    }

    throw new ExecutionError(options);
  }

  private mapStorageErrorCode(code: StorageError["code"]): ExecutionError["code"] {
    switch (code) {
      case "TABLE_NOT_FOUND":
        return "TABLE_NOT_FOUND";
      case "TABLE_ALREADY_EXISTS":
        return "TABLE_ALREADY_EXISTS";
      case "UNKNOWN_COLUMN":
      case "INVALID_COLUMN_NAME":
        return "COLUMN_NOT_FOUND";
      case "DUPLICATE_COLUMN":
        return "DUPLICATE_COLUMN";
      case "TYPE_MISMATCH":
      case "INVALID_NUMBER":
        return "TYPE_MISMATCH";
      case "NULL_CONSTRAINT":
        return "NULL_CONSTRAINT";
      case "INVALID_TABLE_NAME":
      case "MISSING_COLUMN":
        return "INVALID_STATEMENT";
    }
  }

  private assertNever(statement: never): never {
    throw new ExecutionError({
      code: "UNSUPPORTED_STATEMENT",
      message: `Unsupported statement type "${String(statement)}"`
    });
  }
}

export function executeSql(database: Database, sql: string): StatementResult {
  const tokens = new Lexer(sql).tokenize();
  const statement = new Parser(tokens).parse();
  return new Executor(database).execute(statement);
}
