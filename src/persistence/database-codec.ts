import { PersistenceError } from "../errors/persistence-error.js";
import { DataType } from "../storage/data-type.js";
import type { DatabaseValue, StoredRow } from "../storage/row.js";
import type { DatabaseSnapshot, TableSnapshot } from "../storage/transaction.js";
import {
  CURRENT_STORAGE_FORMAT_VERSION,
  STORAGE_FORMAT_NAME,
  type PersistedColumn,
  type PersistedDatabaseFile,
  type PersistedForeignKey,
  type PersistedPrimaryKey,
  type PersistedRow,
  type PersistedTable,
  type PersistedUniqueConstraint
} from "./storage-format.js";

export interface DatabaseEncodeOptions {
  savedAt?: string;
}

export class DatabaseCodec {
  public encode(snapshot: DatabaseSnapshot, options: DatabaseEncodeOptions = {}): string {
    const file = this.snapshotToPersistedFile(snapshot, options.savedAt ?? new Date().toISOString());
    this.validatePersistedFile(file);
    return `${JSON.stringify(file, null, 2)}\n`;
  }

  public decode(serialised: string): DatabaseSnapshot {
    let parsed: unknown;
    try {
      parsed = JSON.parse(serialised);
    } catch {
      throw new PersistenceError({
        code: "PERSISTENCE_FILE_CORRUPT",
        message: "Database file is not valid JSON."
      });
    }

    const file = this.validatePersistedFile(parsed);
    return this.persistedFileToSnapshot(file);
  }

  private snapshotToPersistedFile(snapshot: DatabaseSnapshot, savedAt: string): PersistedDatabaseFile {
    return {
      format: STORAGE_FORMAT_NAME,
      version: CURRENT_STORAGE_FORMAT_VERSION,
      savedAt,
      database: {
        tables: snapshot.tables.map((table) => this.snapshotTableToPersisted(table))
      }
    };
  }

  private snapshotTableToPersisted(table: TableSnapshot): PersistedTable {
    const columnNames = table.columns.map((column) => column.name);
    const primaryKey = table.primaryKey === undefined ? undefined : { columnName: table.primaryKey.columnName };

    return {
      name: table.name,
      columns: table.columns.map((column): PersistedColumn => ({
        name: column.name,
        dataType: column.type,
        nullable: column.nullable
      })),
      ...(primaryKey === undefined ? {} : { primaryKey }),
      uniqueConstraints: table.uniqueConstraints.map((constraint): PersistedUniqueConstraint => ({
        columnName: constraint.columnName
      })),
      foreignKeys: table.foreignKeys.map((foreignKey): PersistedForeignKey => ({
        columnName: foreignKey.columnName,
        referencedTableName: foreignKey.referencedTableName,
        referencedColumnName: foreignKey.referencedColumnName
      })),
      rows: table.rows.map((row): PersistedRow => {
        const persistedRow: PersistedRow = {};
        for (const columnName of columnNames) {
          persistedRow[columnName] = row[columnName] ?? null;
        }
        return persistedRow;
      })
    };
  }

  private persistedFileToSnapshot(file: PersistedDatabaseFile): DatabaseSnapshot {
    return {
      tables: file.database.tables.map((table): TableSnapshot => {
        const primaryKeyColumn = table.primaryKey?.columnName;
        const uniqueColumns = new Set(table.uniqueConstraints.map((constraint) => this.normalizeName(constraint.columnName)));
        const foreignKeysByColumn = new Map(table.foreignKeys.map((foreignKey) => [
          this.normalizeName(foreignKey.columnName),
          foreignKey
        ]));

        return {
          name: table.name,
          columns: table.columns.map((column) => {
            const foreignKey = foreignKeysByColumn.get(this.normalizeName(column.name));
            return {
              name: column.name,
              type: column.dataType,
              nullable: primaryKeyColumn !== undefined && this.namesEqual(primaryKeyColumn, column.name) ? false : column.nullable,
              unique: uniqueColumns.has(this.normalizeName(column.name)),
              primaryKey: primaryKeyColumn !== undefined && this.namesEqual(primaryKeyColumn, column.name),
              ...(foreignKey === undefined ? {} : {
                references: {
                  tableName: foreignKey.referencedTableName,
                  columnName: foreignKey.referencedColumnName
                }
              })
            };
          }),
          ...(table.primaryKey === undefined ? {} : { primaryKey: { ...table.primaryKey } }),
          uniqueConstraints: table.uniqueConstraints.map((constraint) => ({ ...constraint })),
          foreignKeys: table.foreignKeys.map((foreignKey) => ({ ...foreignKey })),
          rows: table.rows.map((row) => ({ ...row }))
        };
      })
    };
  }

  private validatePersistedFile(value: unknown): PersistedDatabaseFile {
    const file = this.expectRecord(value, "root database file");
    if (file.format !== STORAGE_FORMAT_NAME) {
      throw new PersistenceError({
        code: "INVALID_STORAGE_FORMAT",
        message: "Database file has an invalid format marker."
      });
    }

    if (!Number.isInteger(file.version)) {
      throw new PersistenceError({
        code: "INVALID_STORAGE_FORMAT",
        message: "Database file version must be an integer."
      });
    }

    const version = file.version as number;
    if (version !== CURRENT_STORAGE_FORMAT_VERSION) {
      throw new PersistenceError({
        code: "UNSUPPORTED_STORAGE_VERSION",
        message: `Unsupported storage format version ${String(version)}.`,
        foundVersion: version,
        supportedVersions: [CURRENT_STORAGE_FORMAT_VERSION]
      });
    }

    if (typeof file.savedAt !== "string") {
      throw new PersistenceError({
        code: "INVALID_STORAGE_FORMAT",
        message: "Database file savedAt must be a string."
      });
    }

    const database = this.expectRecord(file.database, "database");
    if (!Array.isArray(database.tables)) {
      throw new PersistenceError({
        code: "INVALID_STORAGE_FORMAT",
        message: "Database tables must be an array."
      });
    }

    const tables = database.tables.map((table, index) => this.validateTable(table, index));
    this.validateTableNames(tables);
    this.validateForeignKeySchemas(tables);
    this.validateRows(tables);

    return {
      format: STORAGE_FORMAT_NAME,
      version: CURRENT_STORAGE_FORMAT_VERSION,
      savedAt: file.savedAt,
      database: { tables }
    };
  }

  private validateTable(value: unknown, tableIndex: number): PersistedTable {
    const table = this.expectRecord(value, `table at index ${tableIndex}`);
    if (typeof table.name !== "string" || table.name.trim().length === 0) {
      throw new PersistenceError({
        code: "INVALID_PERSISTED_SCHEMA",
        message: "Persisted table name must be a non-empty string."
      });
    }
    const tableName = table.name;

    if (!Array.isArray(table.columns) || table.columns.length === 0) {
      throw new PersistenceError({
        code: "INVALID_PERSISTED_SCHEMA",
        message: `Persisted table "${tableName}" must contain columns.`,
        tableName
      });
    }

    const columns = table.columns.map((column, index) => this.validateColumn(column, tableName, index));
    this.validateColumnNames(tableName, columns);
    const primaryKey = table.primaryKey === undefined ? undefined : this.validatePrimaryKey(table.primaryKey, tableName, columns);
    const uniqueConstraints = this.validateUniqueConstraints(table.uniqueConstraints, tableName, columns, primaryKey);
    const foreignKeys = this.validateForeignKeys(table.foreignKeys, tableName, columns);

    if (!Array.isArray(table.rows)) {
      throw new PersistenceError({
        code: "INVALID_PERSISTED_ROW",
        message: `Rows for table "${tableName}" must be an array.`,
        tableName
      });
    }

    const rows = table.rows.map((row, rowIndex) => this.validateRow(row, tableName, columns, rowIndex));

    return {
      name: tableName,
      columns,
      ...(primaryKey === undefined ? {} : { primaryKey }),
      uniqueConstraints,
      foreignKeys,
      rows
    };
  }

  private validateColumn(value: unknown, tableName: string, columnIndex: number): PersistedColumn {
    const column = this.expectRecord(value, `column ${columnIndex} in table ${tableName}`);
    if (typeof column.name !== "string" || column.name.trim().length === 0) {
      throw new PersistenceError({
        code: "INVALID_PERSISTED_SCHEMA",
        message: `Column ${columnIndex} in table "${tableName}" must have a non-empty name.`,
        tableName
      });
    }

    if (!this.isDataType(column.dataType)) {
      throw new PersistenceError({
        code: "INVALID_PERSISTED_SCHEMA",
        message: `Column "${column.name}" in table "${tableName}" has an invalid data type.`,
        tableName,
        columnName: column.name
      });
    }

    if (typeof column.nullable !== "boolean") {
      throw new PersistenceError({
        code: "INVALID_PERSISTED_SCHEMA",
        message: `Column "${column.name}" in table "${tableName}" must declare nullability.`,
        tableName,
        columnName: column.name
      });
    }

    return {
      name: column.name,
      dataType: column.dataType,
      nullable: column.nullable
    };
  }

  private validatePrimaryKey(value: unknown, tableName: string, columns: readonly PersistedColumn[]): PersistedPrimaryKey {
    const primaryKey = this.expectRecord(value, `primary key for table ${tableName}`);
    if (typeof primaryKey.columnName !== "string" || !this.hasColumn(columns, primaryKey.columnName)) {
      throw new PersistenceError({
        code: "INVALID_PERSISTED_CONSTRAINT",
        message: `Primary key for table "${tableName}" references an unknown column.`,
        tableName
      });
    }

    return { columnName: this.canonicalColumnName(columns, primaryKey.columnName) };
  }

  private validateUniqueConstraints(
    value: unknown,
    tableName: string,
    columns: readonly PersistedColumn[],
    primaryKey: PersistedPrimaryKey | undefined
  ): PersistedUniqueConstraint[] {
    if (!Array.isArray(value)) {
      throw new PersistenceError({
        code: "INVALID_PERSISTED_CONSTRAINT",
        message: `Unique constraints for table "${tableName}" must be an array.`,
        tableName
      });
    }

    const seen = new Set<string>();
    const constraints = value.map((constraint): PersistedUniqueConstraint => {
      const record = this.expectRecord(constraint, `unique constraint for table ${tableName}`);
      if (typeof record.columnName !== "string" || !this.hasColumn(columns, record.columnName)) {
        throw new PersistenceError({
          code: "INVALID_PERSISTED_CONSTRAINT",
          message: `Unique constraint for table "${tableName}" references an unknown column.`,
          tableName
        });
      }

      const columnName = this.canonicalColumnName(columns, record.columnName);
      const key = this.normalizeName(columnName);
      if (seen.has(key)) {
        throw new PersistenceError({
          code: "INVALID_PERSISTED_CONSTRAINT",
          message: `Duplicate unique constraint for "${tableName}.${columnName}".`,
          tableName,
          columnName
        });
      }
      seen.add(key);
      return { columnName };
    });

    if (primaryKey !== undefined && !seen.has(this.normalizeName(primaryKey.columnName))) {
      constraints.unshift({ columnName: primaryKey.columnName });
    }

    return constraints;
  }

  private validateForeignKeys(value: unknown, tableName: string, columns: readonly PersistedColumn[]): PersistedForeignKey[] {
    if (!Array.isArray(value)) {
      throw new PersistenceError({
        code: "INVALID_PERSISTED_CONSTRAINT",
        message: `Foreign keys for table "${tableName}" must be an array.`,
        tableName
      });
    }

    const seen = new Set<string>();
    return value.map((foreignKey): PersistedForeignKey => {
      const record = this.expectRecord(foreignKey, `foreign key for table ${tableName}`);
      if (typeof record.columnName !== "string" || !this.hasColumn(columns, record.columnName)) {
        throw new PersistenceError({
          code: "INVALID_PERSISTED_CONSTRAINT",
          message: `Foreign key for table "${tableName}" references an unknown local column.`,
          tableName
        });
      }

      if (typeof record.referencedTableName !== "string" || typeof record.referencedColumnName !== "string") {
        throw new PersistenceError({
          code: "INVALID_PERSISTED_CONSTRAINT",
          message: `Foreign key for table "${tableName}" must reference a table and column.`,
          tableName
        });
      }

      const columnName = this.canonicalColumnName(columns, record.columnName);
      const key = this.normalizeName(columnName);
      if (seen.has(key)) {
        throw new PersistenceError({
          code: "INVALID_PERSISTED_CONSTRAINT",
          message: `Duplicate foreign key for "${tableName}.${columnName}".`,
          tableName,
          columnName
        });
      }
      seen.add(key);

      return {
        columnName,
        referencedTableName: record.referencedTableName,
        referencedColumnName: record.referencedColumnName
      };
    });
  }

  private validateRow(value: unknown, tableName: string, columns: readonly PersistedColumn[], rowIndex: number): PersistedRow {
    const row = this.expectRecord(value, `row ${rowIndex} in table ${tableName}`);
    const columnNames = new Set(columns.map((column) => this.normalizeName(column.name)));
    const persistedRow: PersistedRow = {};

    for (const key of Object.keys(row)) {
      if (!columnNames.has(this.normalizeName(key))) {
        throw new PersistenceError({
          code: "INVALID_PERSISTED_ROW",
          message: `Row ${rowIndex} in table "${tableName}" contains unknown column "${key}".`,
          tableName,
          columnName: key,
          rowIndex
        });
      }
    }

    for (const column of columns) {
      if (!(column.name in row)) {
        throw new PersistenceError({
          code: "INVALID_PERSISTED_ROW",
          message: `Row ${rowIndex} in table "${tableName}" is missing column "${column.name}".`,
          tableName,
          columnName: column.name,
          rowIndex
        });
      }

      const valueForColumn = row[column.name];
      this.validateValue(tableName, column, rowIndex, valueForColumn);
      persistedRow[column.name] = valueForColumn;
    }

    return persistedRow;
  }

  private validateRows(tables: readonly PersistedTable[]): void {
    const tableByName = new Map(tables.map((table) => [this.normalizeName(table.name), table]));

    for (const table of tables) {
      const primaryKeyColumn = table.primaryKey?.columnName;
      if (primaryKeyColumn !== undefined) {
        this.validateUniqueRows(table, primaryKeyColumn, true);
      }

      for (const unique of table.uniqueConstraints) {
        this.validateUniqueRows(table, unique.columnName, false);
      }

      for (const foreignKey of table.foreignKeys) {
        const referencedTable = tableByName.get(this.normalizeName(foreignKey.referencedTableName));
        if (referencedTable === undefined) {
          throw new PersistenceError({
            code: "INVALID_PERSISTED_CONSTRAINT",
            message: `Foreign key "${table.name}.${foreignKey.columnName}" references a missing table.`,
            tableName: table.name,
            columnName: foreignKey.columnName
          });
        }

        const referencedColumn = this.canonicalColumnName(referencedTable.columns, foreignKey.referencedColumnName);
        for (const [rowIndex, row] of table.rows.entries()) {
          const value = row[foreignKey.columnName];
          if (value === null) {
            continue;
          }

          if (!referencedTable.rows.some((referencedRow) => Object.is(referencedRow[referencedColumn], value))) {
            throw new PersistenceError({
              code: "INVALID_PERSISTED_ROW",
              message: `Row ${rowIndex} in table "${table.name}" violates foreign key "${foreignKey.columnName}".`,
              tableName: table.name,
              columnName: foreignKey.columnName,
              rowIndex
            });
          }
        }
      }
    }
  }

  private validateUniqueRows(table: PersistedTable, columnName: string, rejectNull: boolean): void {
    const seen = new Set<string>();
    for (const [rowIndex, row] of table.rows.entries()) {
      const value = row[columnName];
      if (value === null) {
        if (rejectNull) {
          throw new PersistenceError({
            code: "INVALID_PERSISTED_ROW",
            message: `Primary key "${table.name}.${columnName}" cannot be null.`,
            tableName: table.name,
            columnName,
            rowIndex
          });
        }
        continue;
      }

      const key = JSON.stringify([typeof value, value]);
      if (seen.has(key)) {
        throw new PersistenceError({
          code: rejectNull ? "INVALID_PERSISTED_CONSTRAINT" : "INVALID_PERSISTED_ROW",
          message: `Duplicate value for persisted unique column "${table.name}.${columnName}".`,
          tableName: table.name,
          columnName,
          rowIndex
        });
      }
      seen.add(key);
    }
  }

  private validateForeignKeySchemas(tables: readonly PersistedTable[]): void {
    const tableByName = new Map(tables.map((table) => [this.normalizeName(table.name), table]));
    for (const table of tables) {
      for (const foreignKey of table.foreignKeys) {
        const localColumn = table.columns.find((column) => this.namesEqual(column.name, foreignKey.columnName));
        const referencedTable = tableByName.get(this.normalizeName(foreignKey.referencedTableName));
        if (localColumn === undefined || referencedTable === undefined) {
          throw new PersistenceError({
            code: "INVALID_PERSISTED_CONSTRAINT",
            message: `Foreign key "${table.name}.${foreignKey.columnName}" references missing schema metadata.`,
            tableName: table.name,
            columnName: foreignKey.columnName
          });
        }

        const referencedColumn = referencedTable.columns.find((column) => this.namesEqual(column.name, foreignKey.referencedColumnName));
        if (referencedColumn === undefined) {
          throw new PersistenceError({
            code: "INVALID_PERSISTED_CONSTRAINT",
            message: `Foreign key "${table.name}.${foreignKey.columnName}" references a missing column.`,
            tableName: table.name,
            columnName: foreignKey.columnName
          });
        }

        const referencedIsUnique = referencedTable.primaryKey !== undefined && this.namesEqual(referencedTable.primaryKey.columnName, referencedColumn.name)
          || referencedTable.uniqueConstraints.some((constraint) => this.namesEqual(constraint.columnName, referencedColumn.name));
        if (!referencedIsUnique || localColumn.dataType !== referencedColumn.dataType) {
          throw new PersistenceError({
            code: "INVALID_PERSISTED_CONSTRAINT",
            message: `Foreign key "${table.name}.${foreignKey.columnName}" has an invalid target.`,
            tableName: table.name,
            columnName: foreignKey.columnName
          });
        }
      }
    }
  }

  private validateTableNames(tables: readonly PersistedTable[]): void {
    const seen = new Set<string>();
    for (const table of tables) {
      const key = this.normalizeName(table.name);
      if (seen.has(key)) {
        throw new PersistenceError({
          code: "INVALID_PERSISTED_SCHEMA",
          message: `Duplicate persisted table "${table.name}".`,
          tableName: table.name
        });
      }
      seen.add(key);
    }
  }

  private validateColumnNames(tableName: string, columns: readonly PersistedColumn[]): void {
    const seen = new Set<string>();
    for (const column of columns) {
      const key = this.normalizeName(column.name);
      if (seen.has(key)) {
        throw new PersistenceError({
          code: "INVALID_PERSISTED_SCHEMA",
          message: `Duplicate persisted column "${column.name}" in table "${tableName}".`,
          tableName,
          columnName: column.name
        });
      }
      seen.add(key);
    }
  }

  private validateValue(tableName: string, column: PersistedColumn, rowIndex: number, value: unknown): asserts value is DatabaseValue {
    if (value === null) {
      if (column.nullable) {
        return;
      }

      throw new PersistenceError({
        code: "INVALID_PERSISTED_ROW",
        message: `Persisted value for "${tableName}.${column.name}" cannot be null.`,
        tableName,
        columnName: column.name,
        rowIndex
      });
    }

    switch (column.dataType) {
      case DataType.INTEGER:
        if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
          this.throwInvalidValue(tableName, column.name, rowIndex);
        }
        return;
      case DataType.DECIMAL:
        if (typeof value !== "number" || !Number.isFinite(value)) {
          this.throwInvalidValue(tableName, column.name, rowIndex);
        }
        return;
      case DataType.TEXT:
        if (typeof value !== "string") {
          this.throwInvalidValue(tableName, column.name, rowIndex);
        }
        return;
      case DataType.BOOLEAN:
        if (typeof value !== "boolean") {
          this.throwInvalidValue(tableName, column.name, rowIndex);
        }
        return;
    }
  }

  private throwInvalidValue(tableName: string, columnName: string, rowIndex: number): never {
    throw new PersistenceError({
      code: "INVALID_PERSISTED_ROW",
      message: `Persisted value for "${tableName}.${columnName}" has the wrong type.`,
      tableName,
      columnName,
      rowIndex
    });
  }

  private hasColumn(columns: readonly PersistedColumn[], columnName: string): boolean {
    return columns.some((column) => this.namesEqual(column.name, columnName));
  }

  private canonicalColumnName(columns: readonly PersistedColumn[], columnName: string): string {
    const column = columns.find((candidate) => this.namesEqual(candidate.name, columnName));
    if (column === undefined) {
      throw new PersistenceError({
        code: "INVALID_PERSISTED_CONSTRAINT",
        message: `Unknown persisted column "${columnName}".`,
        columnName
      });
    }
    return column.name;
  }

  private expectRecord(value: unknown, description: string): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new PersistenceError({
        code: "INVALID_STORAGE_FORMAT",
        message: `Expected ${description} to be an object.`
      });
    }

    return value as Record<string, unknown>;
  }

  private isDataType(value: unknown): value is DataType {
    return value === DataType.INTEGER || value === DataType.DECIMAL || value === DataType.TEXT || value === DataType.BOOLEAN;
  }

  private namesEqual(left: string, right: string): boolean {
    return this.normalizeName(left) === this.normalizeName(right);
  }

  private normalizeName(name: string): string {
    return name.toLowerCase();
  }
}
