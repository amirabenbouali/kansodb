import { ExecutionError, type ExecutionErrorOptions } from "../errors/execution-error.js";
import { StorageError } from "../errors/storage-error.js";
import { Lexer } from "../lexer/lexer.js";
import { Parser } from "../parser/parser.js";
import type {
  CreateColumnDataType,
  CreateTableStatement,
  DeleteStatement,
  InsertStatement,
  SelectStatement,
  Statement,
  TableConstraint,
  UpdateStatement
} from "../parser/ast.js";
import type { ColumnDefinition } from "../storage/column.js";
import type { Database } from "../storage/database.js";
import { DataType } from "../storage/data-type.js";
import type { DatabaseValue, InputRow, StoredRow } from "../storage/row.js";
import type { Table } from "../storage/table.js";
import { evaluateExpression, evaluateScalar, tableContext } from "./expression-evaluator.js";
import { JoinExecutor } from "./join-executor.js";
import type { QueryResult } from "./query-result.js";
import type { CreateTableResult, DeleteResult, InsertResult, StatementResult, UpdateResult } from "./statement-result.js";

interface ResolvedColumn {
  queryName: string;
  schemaName: string;
}

export class Executor {
  private readonly database: Database;

  public constructor(database: Database) {
    this.database = database;
  }

  public execute(statement: SelectStatement): QueryResult;
  public execute(statement: CreateTableStatement): CreateTableResult;
  public execute(statement: InsertStatement): InsertResult;
  public execute(statement: UpdateStatement): UpdateResult;
  public execute(statement: DeleteStatement): DeleteResult;
  public execute(statement: Statement): StatementResult;
  public execute(statement: Statement): StatementResult {
    switch (statement.type) {
      case "select":
        return this.executeSelect(statement);
      case "create_table":
        return this.executeCreateTable(statement);
      case "insert":
        return this.executeInsert(statement);
      case "update":
        return this.executeUpdate(statement);
      case "delete":
        return this.executeDelete(statement);
    }

    return this.assertNever(statement);
  }

  private executeSelect(statement: SelectStatement): QueryResult {
    return new JoinExecutor().execute(statement, this.database);
  }

  private executeCreateTable(statement: CreateTableStatement): CreateTableResult {
    const columns = this.buildCreateTableColumns(statement);

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
      this.database.insertInto(table.name, row);
    } catch (error) {
      this.throwExecutionErrorFromStorage(error);
    }

    return {
      type: "insert",
      tableName: table.name,
      affectedRows: 1
    };
  }

  private executeUpdate(statement: UpdateStatement): UpdateResult {
    const table = this.resolveTable(statement.tableName);
    const assignments = this.resolveAssignments(statement, table);

    if (statement.where !== undefined) {
      this.validateExpressionColumns(statement.where, table);
    }

    try {
      const affectedRows = this.database.updateRows(
        table.name,
        (row) => (statement.where === undefined ? true : evaluateExpression(statement.where, row, table)),
        (row) => {
          const updatedRow: InputRow = { ...row };
          const context = tableContext(row, table);

          for (const assignment of assignments) {
            updatedRow[assignment.schemaName] = evaluateScalar(assignment.expression, context);
          }

          return updatedRow;
        }
      );

      return {
        type: "update",
        tableName: table.name,
        affectedRows
      };
    } catch (error) {
      this.throwExecutionErrorFromStorage(error);
    }
  }

  private executeDelete(statement: DeleteStatement): DeleteResult {
    const table = this.resolveTable(statement.tableName);

    if (statement.where !== undefined) {
      this.validateExpressionColumns(statement.where, table);
    }

    try {
      const affectedRows = this.database.deleteRows(
        table.name,
        (row) => (statement.where === undefined ? true : evaluateExpression(statement.where, row, table))
      );

      return {
        type: "delete",
        tableName: table.name,
        affectedRows
      };
    } catch (error) {
      this.throwExecutionErrorFromStorage(error);
    }
  }

  private buildCreateTableColumns(statement: CreateTableStatement): ColumnDefinition[] {
    const columns = statement.columns.map((column): ColumnDefinition => ({
      name: column.name,
      type: this.mapDataType(column.dataType),
      nullable: column.nullable,
      unique: column.unique,
      primaryKey: column.primaryKey,
      ...(column.references === undefined ? {} : { references: { ...column.references } })
    }));

    for (const constraint of statement.constraints ?? []) {
      this.applyTableConstraint(statement.tableName, columns, constraint);
    }

    return columns;
  }

  private applyTableConstraint(tableName: string, columns: ColumnDefinition[], constraint: TableConstraint): void {
    const column = this.resolveCreateColumn(tableName, columns, constraint.columnName);

    if (constraint.type === "primary_key") {
      const existingPrimaryKey = columns.find((candidate) => candidate.primaryKey === true);
      if (column.primaryKey === true) {
        throw new ExecutionError({
          code: "DUPLICATE_PRIMARY_KEY",
          message: `Duplicate primary key declaration for "${tableName}.${column.name}".`,
          tableName,
          columnName: column.name
        });
      }

      if (existingPrimaryKey !== undefined) {
        throw new ExecutionError({
          code: "MULTIPLE_PRIMARY_KEYS",
          message: `Table "${tableName}" declares more than one primary key.`,
          tableName,
          columnName: constraint.columnName
        });
      }

      column.primaryKey = true;
      column.unique = true;
      column.nullable = false;
      return;
    }

    if (column.references !== undefined) {
      throw new ExecutionError({
        code: "DUPLICATE_CONSTRAINT",
        message: `Duplicate foreign key declaration for "${tableName}.${column.name}".`,
        tableName,
        columnName: column.name
      });
    }

    column.references = { ...constraint.references };
  }

  private resolveCreateColumn(tableName: string, columns: readonly ColumnDefinition[], columnName: string): ColumnDefinition {
    const column = columns.find((candidate) => candidate.name.toLowerCase() === columnName.toLowerCase());
    if (column === undefined) {
      throw new ExecutionError({
        code: "CONSTRAINT_COLUMN_NOT_FOUND",
        message: `Constraint column "${columnName}" was not found in table "${tableName}".`,
        tableName,
        columnName
      });
    }

    return column;
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

  private resolveAssignments(statement: UpdateStatement, table: Table): Array<{ schemaName: string; expression: UpdateStatement["assignments"][number]["value"] }> {
    const seen = new Set<string>();

    return statement.assignments.map((assignment) => {
      const resolved = this.resolveColumn(assignment.columnName, table);
      const key = resolved.schemaName.toLowerCase();

      if (seen.has(key)) {
        throw new ExecutionError({
          code: "DUPLICATE_COLUMN",
          message: `Column "${assignment.columnName}" is assigned more than once.`,
          tableName: table.name,
          columnName: assignment.columnName
        });
      }

      seen.add(key);
      this.validateExpressionColumns(assignment.value, table);
      return {
        schemaName: resolved.schemaName,
        expression: assignment.value
      };
    });
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

    switch (expression.type) {
      case "literal":
        return;
      case "column":
        this.resolveColumn(expression.name, table);
        return;
      case "aggregate":
        throw new ExecutionError({
          code: "INVALID_AGGREGATE_PLACEMENT",
          message: "Aggregate functions are not allowed in row-level expressions."
        });
      case "unary":
        this.validateExpressionColumns(expression.operand, table);
        return;
      case "null_check":
        this.validateExpressionColumns(expression.operand, table);
        return;
      case "arithmetic":
      case "comparison":
      case "logical":
        this.validateExpressionColumns(expression.left, table);
        this.validateExpressionColumns(expression.right, table);
        return;
    }
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

    if (error.referencedTableName !== undefined) {
      options.referencedTableName = error.referencedTableName;
    }

    if (error.referencedColumnName !== undefined) {
      options.referencedColumnName = error.referencedColumnName;
    }

    if (error.referencingTableName !== undefined) {
      options.referencingTableName = error.referencingTableName;
    }

    if (error.referencingColumnName !== undefined) {
      options.referencingColumnName = error.referencingColumnName;
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
      case "NOT_NULL_VIOLATION":
        return "NOT_NULL_VIOLATION";
      case "PRIMARY_KEY_VIOLATION":
        return "PRIMARY_KEY_VIOLATION";
      case "UNIQUE_CONSTRAINT_VIOLATION":
        return "UNIQUE_CONSTRAINT_VIOLATION";
      case "FOREIGN_KEY_VIOLATION":
        return "FOREIGN_KEY_VIOLATION";
      case "REFERENCED_ROW_EXISTS":
        return "REFERENCED_ROW_EXISTS";
      case "DUPLICATE_PRIMARY_KEY":
        return "DUPLICATE_PRIMARY_KEY";
      case "DUPLICATE_CONSTRAINT":
        return "DUPLICATE_CONSTRAINT";
      case "INVALID_CONSTRAINT":
        return "INVALID_CONSTRAINT";
      case "CONSTRAINT_COLUMN_NOT_FOUND":
        return "CONSTRAINT_COLUMN_NOT_FOUND";
      case "REFERENCED_TABLE_NOT_FOUND":
        return "REFERENCED_TABLE_NOT_FOUND";
      case "REFERENCED_COLUMN_NOT_FOUND":
        return "REFERENCED_COLUMN_NOT_FOUND";
      case "REFERENCED_COLUMN_NOT_UNIQUE":
        return "REFERENCED_COLUMN_NOT_UNIQUE";
      case "FOREIGN_KEY_TYPE_MISMATCH":
        return "FOREIGN_KEY_TYPE_MISMATCH";
      case "MULTIPLE_PRIMARY_KEYS":
        return "MULTIPLE_PRIMARY_KEYS";
      case "UNSUPPORTED_COMPOSITE_KEY":
        return "UNSUPPORTED_COMPOSITE_KEY";
      case "UNSUPPORTED_CONSTRAINT":
        return "UNSUPPORTED_CONSTRAINT";
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
