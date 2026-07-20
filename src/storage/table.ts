import { StorageError } from "../errors/storage-error.js";
import { type ColumnDefinition, normalizeColumnDefinitions, normalizeColumnName, type StoredColumnDefinition } from "./column.js";
import { DataType } from "./data-type.js";
import type { DatabaseValue, InputRow, StoredRow } from "./row.js";

export class Table {
  private readonly tableName: string;
  private readonly schema: StoredColumnDefinition[];
  private readonly rows: StoredRow[] = [];
  private readonly columnsByName: Map<string, StoredColumnDefinition>;

  public constructor(name: string, columns: readonly ColumnDefinition[]) {
    const trimmedName = name.trim();

    if (trimmedName.length === 0) {
      throw new StorageError({
        code: "INVALID_TABLE_NAME",
        message: "Table name must not be empty",
        tableName: name
      });
    }

    this.tableName = name;
    this.schema = normalizeColumnDefinitions(columns, name);
    this.columnsByName = new Map(this.schema.map((column) => [normalizeColumnName(column.name), column]));
  }

  public get name(): string {
    return this.tableName;
  }

  public getSchema(): StoredColumnDefinition[] {
    return this.schema.map((column) => ({ ...column }));
  }

  public insert(row: InputRow): StoredRow {
    const valuesByColumnName = this.mapInputRow(row);

    const storedRow: StoredRow = {};

    for (const column of this.schema) {
      const value = valuesByColumnName.get(normalizeColumnName(column.name));

      if (value === undefined) {
        if (column.nullable) {
          storedRow[column.name] = null;
          continue;
        }

        throw new StorageError({
          code: "MISSING_COLUMN",
          message: `Missing required column "${column.name}" for table "${this.tableName}"`,
          tableName: this.tableName,
          columnName: column.name
        });
      }

      storedRow[column.name] = this.validateValue(column, value);
    }

    this.rows.push(storedRow);
    return { ...storedRow };
  }

  public getRows(): StoredRow[] {
    return this.rows.map((row) => ({ ...row }));
  }

  public rowCount(): number {
    return this.rows.length;
  }

  public hasColumn(name: string): boolean {
    return this.columnsByName.has(normalizeColumnName(name));
  }

  public getColumn(name: string): StoredColumnDefinition {
    const column = this.columnsByName.get(normalizeColumnName(name));

    if (column === undefined) {
      throw new StorageError({
        code: "UNKNOWN_COLUMN",
        message: `Unknown column "${name}" in table "${this.tableName}"`,
        tableName: this.tableName,
        columnName: name
      });
    }

    return { ...column };
  }

  public clear(): void {
    this.rows.length = 0;
  }

  private mapInputRow(row: InputRow): Map<string, DatabaseValue | undefined> {
    const valuesByColumnName = new Map<string, DatabaseValue | undefined>();

    for (const columnName of Object.keys(row)) {
      const normalizedName = normalizeColumnName(columnName);

      if (!this.columnsByName.has(normalizedName)) {
        throw new StorageError({
          code: "UNKNOWN_COLUMN",
          message: `Unknown column "${columnName}" in table "${this.tableName}"`,
          tableName: this.tableName,
          columnName
        });
      }

      if (valuesByColumnName.has(normalizedName)) {
        throw new StorageError({
          code: "DUPLICATE_COLUMN",
          message: `Duplicate value for column "${columnName}" in table "${this.tableName}"`,
          tableName: this.tableName,
          columnName
        });
      }

      valuesByColumnName.set(normalizedName, row[columnName]);
    }

    return valuesByColumnName;
  }

  private validateValue(column: StoredColumnDefinition, value: DatabaseValue | undefined): DatabaseValue {
    if (value === null) {
      if (column.nullable) {
        return null;
      }

      throw new StorageError({
        code: "NULL_CONSTRAINT",
        message: `Column "${column.name}" does not allow null values`,
        tableName: this.tableName,
        columnName: column.name,
        value
      });
    }

    if (value === undefined) {
      throw new StorageError({
        code: "MISSING_COLUMN",
        message: `Missing required column "${column.name}" for table "${this.tableName}"`,
        tableName: this.tableName,
        columnName: column.name
      });
    }

    this.validateType(column, value);
    return value;
  }

  private validateType(column: StoredColumnDefinition, value: Exclude<DatabaseValue, null>): void {
    switch (column.type) {
      case DataType.INTEGER:
        this.validateInteger(column, value);
        return;
      case DataType.DECIMAL:
        this.validateDecimal(column, value);
        return;
      case DataType.TEXT:
        this.validateText(column, value);
        return;
      case DataType.BOOLEAN:
        this.validateBoolean(column, value);
        return;
    }
  }

  private validateInteger(column: StoredColumnDefinition, value: Exclude<DatabaseValue, null>): void {
    if (typeof value !== "number") {
      this.throwTypeMismatch(column, value, "integer");
    }

    if (!Number.isFinite(value)) {
      this.throwInvalidNumber(column, value);
    }

    if (!Number.isInteger(value)) {
      this.throwTypeMismatch(column, value, "integer");
    }
  }

  private validateDecimal(column: StoredColumnDefinition, value: Exclude<DatabaseValue, null>): void {
    if (typeof value !== "number") {
      this.throwTypeMismatch(column, value, "number");
    }

    if (!Number.isFinite(value)) {
      this.throwInvalidNumber(column, value);
    }
  }

  private validateText(column: StoredColumnDefinition, value: Exclude<DatabaseValue, null>): void {
    if (typeof value !== "string") {
      this.throwTypeMismatch(column, value, "string");
    }
  }

  private validateBoolean(column: StoredColumnDefinition, value: Exclude<DatabaseValue, null>): void {
    if (typeof value !== "boolean") {
      this.throwTypeMismatch(column, value, "boolean");
    }
  }

  private throwTypeMismatch(column: StoredColumnDefinition, value: DatabaseValue, expected: string): never {
    throw new StorageError({
      code: "TYPE_MISMATCH",
      message: `Column "${column.name}" expected ${expected}, received ${this.describeValue(value)}`,
      tableName: this.tableName,
      columnName: column.name,
      value
    });
  }

  private throwInvalidNumber(column: StoredColumnDefinition, value: number): never {
    throw new StorageError({
      code: "INVALID_NUMBER",
      message: `Column "${column.name}" received invalid number ${String(value)}`,
      tableName: this.tableName,
      columnName: column.name,
      value
    });
  }

  private describeValue(value: DatabaseValue): string {
    if (value === null) {
      return "null";
    }

    return `${typeof value} ${JSON.stringify(value)}`;
  }
}
