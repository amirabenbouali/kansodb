import { StorageError } from "../errors/storage-error.js";
import { type ColumnDefinition, normalizeColumnDefinitions, normalizeColumnName, type StoredColumnDefinition } from "./column.js";
import type { PrimaryKeyMetadata, UniqueConstraintMetadata } from "./constraint.js";
import { DataType } from "./data-type.js";
import type { ForeignKeyMetadata } from "./foreign-key.js";
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
    this.validateSchemaConstraints();
    this.columnsByName = new Map(this.schema.map((column) => [normalizeColumnName(column.name), column]));
  }

  public get name(): string {
    return this.tableName;
  }

  public getSchema(): StoredColumnDefinition[] {
    return this.schema.map((column) => ({
      ...column,
      ...(column.references === undefined ? {} : { references: { ...column.references } })
    }));
  }

  public get primaryKey(): PrimaryKeyMetadata | undefined {
    const column = this.schema.find((schemaColumn) => schemaColumn.primaryKey);
    return column === undefined ? undefined : { columnName: column.name };
  }

  public get uniqueConstraints(): UniqueConstraintMetadata[] {
    return this.schema.filter((column) => column.unique).map((column) => ({ columnName: column.name }));
  }

  public get foreignKeys(): ForeignKeyMetadata[] {
    return this.schema.flatMap((column) => column.references === undefined ? [] : [{
      columnName: column.name,
      referencedTableName: column.references.tableName,
      referencedColumnName: column.references.columnName
    }]);
  }

  public insert(row: InputRow): StoredRow {
    const storedRow = this.validateRow(row);
    this.validateRows([...this.rows, storedRow]);

    this.rows.push(storedRow);
    return { ...storedRow };
  }

  public updateRows(predicate: (row: Readonly<StoredRow>) => boolean, updater: (row: Readonly<StoredRow>) => InputRow): number {
    const replacements: Array<{ index: number; row: StoredRow }> = [];

    this.rows.forEach((row, index) => {
      const rowSnapshot = { ...row };

      if (!predicate(rowSnapshot)) {
        return;
      }

      const replacement = this.validateRow(updater({ ...row }));
      replacements.push({ index, row: replacement });
    });

    const proposed = this.rows.map((row, index) => replacements.find((replacement) => replacement.index === index)?.row ?? row);
    this.validateRows(proposed);

    for (const replacement of replacements) {
      this.rows[replacement.index] = replacement.row;
    }

    return replacements.length;
  }

  public deleteRows(predicate: (row: Readonly<StoredRow>) => boolean): number {
    const remainingRows: StoredRow[] = [];
    let deletedCount = 0;

    for (const row of this.rows) {
      if (predicate({ ...row })) {
        deletedCount += 1;
        continue;
      }

      remainingRows.push(row);
    }

    this.rows.length = 0;
    this.rows.push(...remainingRows);

    return deletedCount;
  }

  private validateRow(row: InputRow): StoredRow {
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

    return storedRow;
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

    return {
      ...column,
      ...(column.references === undefined ? {} : { references: { ...column.references } })
    };
  }

  public clear(): void {
    this.rows.length = 0;
  }

  public validateInputRow(row: InputRow): StoredRow {
    return this.validateRow(row);
  }

  public replaceRows(rows: readonly StoredRow[]): void {
    this.validateRows(rows);
    this.rows.length = 0;
    this.rows.push(...rows.map((row) => ({ ...row })));
  }

  public validateRows(rows: readonly StoredRow[]): void {
    for (const column of this.schema) {
      if (column.primaryKey) {
        this.validateUniqueColumn(rows, column, "PRIMARY_KEY_VIOLATION");
      } else if (column.unique) {
        this.validateUniqueColumn(rows, column, "UNIQUE_CONSTRAINT_VIOLATION");
      }
    }
  }

  private validateSchemaConstraints(): void {
    const primaryKeys = this.schema.filter((column) => column.primaryKey);
    if (primaryKeys.length > 1) {
      throw new StorageError({
        code: "MULTIPLE_PRIMARY_KEYS",
        message: `Table "${this.tableName}" declares more than one primary key.`,
        tableName: this.tableName
      });
    }

    for (const column of primaryKeys) {
      if (column.nullable) {
        throw new StorageError({
          code: "INVALID_CONSTRAINT",
          message: `Primary key column "${column.name}" cannot be nullable.`,
          tableName: this.tableName,
          columnName: column.name
        });
      }
    }
  }

  private validateUniqueColumn(rows: readonly StoredRow[], column: StoredColumnDefinition, code: "PRIMARY_KEY_VIOLATION" | "UNIQUE_CONSTRAINT_VIOLATION"): void {
    const seen = new Set<string>();
    for (const row of rows) {
      const value = row[column.name] ?? null;
      if (value === null) {
        if (column.primaryKey) {
          throw new StorageError({
            code: "PRIMARY_KEY_VIOLATION",
            message: `Primary key violation on ${this.tableName}.${column.name} for null value.`,
            tableName: this.tableName,
            columnName: column.name,
            value
          });
        }
        continue;
      }

      const key = JSON.stringify([typeof value, value]);
      if (seen.has(key)) {
        throw new StorageError({
          code,
          message: `${code === "PRIMARY_KEY_VIOLATION" ? "Primary key" : "Unique constraint"} violation on ${this.tableName}.${column.name}.`,
          tableName: this.tableName,
          columnName: column.name,
          value
        });
      }
      seen.add(key);
    }
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
        code: "NOT_NULL_VIOLATION",
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
