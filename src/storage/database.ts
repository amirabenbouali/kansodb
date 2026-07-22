import { StorageError } from "../errors/storage-error.js";
import { PersistenceError } from "../errors/persistence-error.js";
import type { ScriptExecutionOptions, ScriptExecutionResult } from "../execution/script-result.js";
import type { StatementResult } from "../execution/statement-result.js";
import { DatabaseCodec } from "../persistence/database-codec.js";
import type { FileAdapter } from "../persistence/file-adapter.js";
import { PersistenceManager, type SaveResult } from "../persistence/persistence-manager.js";
import type { ColumnDefinition } from "./column.js";
import type { DatabaseValue, InputRow, StoredRow } from "./row.js";
import { Table } from "./table.js";
import { cloneDatabaseSnapshot, freezeDatabaseSnapshot, type DatabaseSnapshot, type TransactionState } from "./transaction.js";
import { TransactionManager } from "./transaction-manager.js";

export type AutoSaveMode = "off" | "on-commit" | "after-mutation";

export interface DatabaseOpenOptions {
  path?: string;
  fileAdapter?: FileAdapter;
  autoSave?: AutoSaveMode;
}

export interface PersistenceState {
  path: string | null;
  lastSavedAt: string | null;
  lastSavedBytes: number | null;
  dirty: boolean;
}

export class Database {
  private readonly tables = new Map<string, Table>();
  public readonly transactionManager: TransactionManager;
  private persistenceManager: PersistenceManager | undefined;
  private autoSaveMode: AutoSaveMode = "off";
  private persistenceMetadata: PersistenceState = {
    path: null,
    lastSavedAt: null,
    lastSavedBytes: null,
    dirty: false
  };

  public constructor() {
    this.transactionManager = new TransactionManager(this);
  }

  public static async open(options: DatabaseOpenOptions = {}): Promise<Database> {
    const database = new Database();
    database.autoSaveMode = options.autoSave ?? "off";

    if (options.path === undefined) {
      return database;
    }

    const fileAdapter = options.fileAdapter ?? await Database.createDefaultFileAdapter();
    const persistenceManager = new PersistenceManager(
      options.path,
      fileAdapter,
      new DatabaseCodec()
    );
    database.persistenceManager = persistenceManager;
    database.persistenceMetadata = {
      path: options.path,
      lastSavedAt: null,
      lastSavedBytes: null,
      dirty: false
    };

    const snapshot = await persistenceManager.load();
    if (snapshot !== null) {
      database.restoreSnapshot(snapshot);
      database.markClean(null);
    }

    return database;
  }

  private static async createDefaultFileAdapter(): Promise<FileAdapter> {
    const modulePath = "../persistence/node-file-adapter.js";
    const adapterModule = await import(modulePath) as { NodeFileAdapter: new () => FileAdapter };
    return new adapterModule.NodeFileAdapter();
  }

  public createTable(name: string, columns: readonly ColumnDefinition[]): Table {
    this.validateTableName(name);

    const key = this.normalizeTableName(name);
    if (this.tables.has(key)) {
      throw new StorageError({
        code: "TABLE_ALREADY_EXISTS",
        message: `Table "${name}" already exists`,
        tableName: name
      });
    }

    const table = new Table(name, this.canonicalizeReferences(name, columns));
    this.validateCreateTableConstraints(table);
    this.tables.set(key, table);
    this.markDirty();
    return table;
  }

  private canonicalizeReferences(tableName: string, columns: readonly ColumnDefinition[]): ColumnDefinition[] {
    return columns.map((column) => {
      if (column.references === undefined) {
        return { ...column };
      }

      const referencedTable = this.resolveReferencedTableName(tableName, column.name, column.references.tableName);
      const referencedColumn = this.resolveReferencedColumnName(tableName, column.name, columns, referencedTable, column.references.columnName);

      return {
        ...column,
        references: {
          tableName: referencedTable.name,
          columnName: referencedColumn
        }
      };
    });
  }

  private resolveReferencedTableName(
    tableName: string,
    columnName: string,
    referencedTableName: string
  ): { name: string; columns?: readonly ColumnDefinition[]; table?: Table } {
    if (this.normalizeTableName(tableName) === this.normalizeTableName(referencedTableName)) {
      return { name: tableName };
    }

    const table = this.tables.get(this.normalizeTableName(referencedTableName));
    if (table === undefined) {
      throw new StorageError({
        code: "REFERENCED_TABLE_NOT_FOUND",
        message: `Referenced table "${referencedTableName}" was not found.`,
        tableName,
        columnName,
        referencedTableName
      });
    }

    return { name: table.name, table };
  }

  private resolveReferencedColumnName(
    tableName: string,
    columnName: string,
    newTableColumns: readonly ColumnDefinition[],
    referencedTable: { name: string; table?: Table },
    referencedColumnName: string
  ): string {
    if (referencedTable.table !== undefined) {
      try {
        return referencedTable.table.getColumn(referencedColumnName).name;
      } catch {
        throw new StorageError({
          code: "REFERENCED_COLUMN_NOT_FOUND",
          message: `Referenced column "${referencedColumnName}" was not found in table "${referencedTable.name}".`,
          tableName,
          columnName,
          referencedTableName: referencedTable.name,
          referencedColumnName
        });
      }
    }

    const column = newTableColumns.find((candidate) => candidate.name.toLowerCase() === referencedColumnName.toLowerCase());
    if (column === undefined) {
      throw new StorageError({
        code: "REFERENCED_COLUMN_NOT_FOUND",
        message: `Referenced column "${referencedColumnName}" was not found in table "${referencedTable.name}".`,
        tableName,
        columnName,
        referencedTableName: referencedTable.name,
        referencedColumnName
      });
    }

    return column.name;
  }

  public getTable(name: string): Table {
    const table = this.tables.get(this.normalizeTableName(name));

    if (table === undefined) {
      throw new StorageError({
        code: "TABLE_NOT_FOUND",
        message: `Table "${name}" was not found`,
        tableName: name
      });
    }

    return table;
  }

  public hasTable(name: string): boolean {
    return this.tables.has(this.normalizeTableName(name));
  }

  public listTables(): string[] {
    return Array.from(this.tables.values(), (table) => table.name);
  }

  public get transactionState(): TransactionState {
    return this.transactionManager.state;
  }

  public get isTransactionActive(): boolean {
    return this.transactionManager.isActive;
  }

  public get persistencePath(): string | null {
    return this.persistenceMetadata.path;
  }

  public get isPersistent(): boolean {
    return this.persistenceManager !== undefined;
  }

  public get autoSave(): AutoSaveMode {
    return this.autoSaveMode;
  }

  public get persistenceState(): PersistenceState {
    return { ...this.persistenceMetadata };
  }

  public async save(): Promise<SaveResult> {
    if (this.persistenceManager === undefined || this.persistenceMetadata.path === null) {
      throw new PersistenceError({
        code: "PERSISTENCE_PATH_NOT_CONFIGURED",
        message: "No persistence path is configured for this database."
      });
    }

    if (this.isTransactionActive) {
      throw new PersistenceError({
        code: "SAVE_DURING_ACTIVE_TRANSACTION",
        message: "Cannot save while a transaction is active.",
        path: this.persistenceMetadata.path,
        statementType: "save_database"
      });
    }

    const result = await this.persistenceManager.save(this.createSnapshot());
    this.markClean(result.bytesWritten);
    return result;
  }

  public async saveIfConfigured(): Promise<SaveResult | null> {
    if (this.persistenceManager === undefined) {
      return null;
    }

    return this.save();
  }

  public async executeSql(sql: string): Promise<StatementResult> {
    const { executeSqlAsync } = await import("../execution/executor.js");
    return executeSqlAsync(this, sql);
  }

  public async executeSqlScript(sql: string, options?: ScriptExecutionOptions): Promise<ScriptExecutionResult> {
    const { executeSqlScriptAsync } = await import("../execution/script-executor.js");
    return executeSqlScriptAsync(this, sql, options);
  }

  public createSnapshot(): DatabaseSnapshot {
    return freezeDatabaseSnapshot({
      tables: Array.from(this.tables.values(), (table) => ({
        name: table.name,
        columns: table.getSchema(),
        ...(table.primaryKey === undefined ? {} : { primaryKey: { ...table.primaryKey } }),
        uniqueConstraints: table.uniqueConstraints.map((constraint) => ({ ...constraint })),
        foreignKeys: table.foreignKeys.map((foreignKey) => ({ ...foreignKey })),
        rows: table.getRows()
      }))
    });
  }

  public restoreSnapshot(snapshot: DatabaseSnapshot): void {
    const clonedSnapshot = cloneDatabaseSnapshot(snapshot);
    const restoredTables = new Map<string, Table>();

    for (const tableSnapshot of clonedSnapshot.tables) {
      this.validateTableName(tableSnapshot.name);
      const key = this.normalizeTableName(tableSnapshot.name);
      if (restoredTables.has(key)) {
        throw new StorageError({
          code: "TABLE_ALREADY_EXISTS",
          message: `Snapshot contains duplicate table "${tableSnapshot.name}".`,
          tableName: tableSnapshot.name
        });
      }

      const table = new Table(tableSnapshot.name, tableSnapshot.columns);
      table.replaceRows(tableSnapshot.rows);
      restoredTables.set(key, table);
    }

    const currentTables = Array.from(this.tables.entries());
    this.tables.clear();
    for (const [key, table] of restoredTables) {
      this.tables.set(key, table);
    }

    try {
      this.validateCompleteDatabaseState();
    } catch (error) {
      this.tables.clear();
      for (const [key, table] of currentTables) {
        this.tables.set(key, table);
      }
      throw error;
    }
  }

  public dropTable(name: string): void {
    const table = this.getTable(name);
    this.validateIncomingReferences(table, []);
    const key = this.normalizeTableName(name);

    if (!this.tables.delete(key)) {
      throw new StorageError({
        code: "TABLE_NOT_FOUND",
        message: `Table "${name}" was not found`,
        tableName: name
      });
    }

    this.markDirty();
  }

  public insertInto(tableName: string, row: InputRow): StoredRow {
    const table = this.getTable(tableName);
    const storedRow = table.validateInputRow(row);
    const proposedRows = [...table.getRows(), storedRow];

    this.validateTableState(table, proposedRows);
    table.replaceRows(proposedRows);
    this.markDirty();
    return { ...storedRow };
  }

  public updateRows(
    tableName: string,
    predicate: (row: Readonly<StoredRow>) => boolean,
    updater: (row: Readonly<StoredRow>) => InputRow
  ): number {
    const table = this.getTable(tableName);
    const currentRows = table.getRows();
    let affectedRows = 0;
    const proposedRows = currentRows.map((row) => {
      const snapshot = { ...row };

      if (!predicate(snapshot)) {
        return row;
      }

      affectedRows += 1;
      return table.validateInputRow(updater({ ...row }));
    });

    this.validateTableState(table, proposedRows);
    table.replaceRows(proposedRows);
    if (affectedRows > 0) {
      this.markDirty();
    }
    return affectedRows;
  }

  public deleteRows(tableName: string, predicate: (row: Readonly<StoredRow>) => boolean): number {
    const table = this.getTable(tableName);
    const remainingRows: StoredRow[] = [];
    let affectedRows = 0;

    for (const row of table.getRows()) {
      if (predicate({ ...row })) {
        affectedRows += 1;
        continue;
      }

      remainingRows.push(row);
    }

    this.validateTableState(table, remainingRows);
    table.replaceRows(remainingRows);
    if (affectedRows > 0) {
      this.markDirty();
    }
    return affectedRows;
  }

  public validateInsert(tableName: string, row: StoredRow): void {
    const table = this.getTable(tableName);
    this.validateTableState(table, [...table.getRows(), row]);
  }

  public validateUpdate(tableName: string, proposedRows: readonly StoredRow[]): void {
    this.validateTableState(this.getTable(tableName), proposedRows);
  }

  public validateDelete(tableName: string, remainingRows: readonly StoredRow[]): void {
    this.validateTableState(this.getTable(tableName), remainingRows);
  }

  private validateCreateTableConstraints(table: Table): void {
    for (const foreignKey of table.foreignKeys) {
      const localColumn = table.getColumn(foreignKey.columnName);
      const referencedTable = this.resolveReferencedTable(table, foreignKey.referencedTableName);
      const referencedColumn = this.resolveReferencedColumn({
        tableName: table.name,
        columnName: localColumn.name,
        referencedTable,
        referencedColumnName: foreignKey.referencedColumnName
      });

      if (!referencedColumn.primaryKey && !referencedColumn.unique) {
        throw new StorageError({
          code: "REFERENCED_COLUMN_NOT_UNIQUE",
          message: `Referenced column "${referencedTable.name}.${referencedColumn.name}" must be primary key or unique.`,
          tableName: table.name,
          columnName: localColumn.name,
          referencedTableName: referencedTable.name,
          referencedColumnName: referencedColumn.name
        });
      }

      if (localColumn.type !== referencedColumn.type) {
        throw new StorageError({
          code: "FOREIGN_KEY_TYPE_MISMATCH",
          message: `Foreign key "${table.name}.${localColumn.name}" type must match "${referencedTable.name}.${referencedColumn.name}".`,
          tableName: table.name,
          columnName: localColumn.name,
          referencedTableName: referencedTable.name,
          referencedColumnName: referencedColumn.name
        });
      }
    }
  }

  private validateCompleteDatabaseState(): void {
    for (const table of this.tables.values()) {
      this.validateCreateTableConstraints(table);
    }

    for (const table of this.tables.values()) {
      this.validateTableState(table, table.getRows());
    }
  }

  private validateTableState(table: Table, proposedRows: readonly StoredRow[]): void {
    table.validateRows(proposedRows);
    this.validateOutgoingForeignKeys(table, proposedRows);
    this.validateIncomingReferences(table, proposedRows);
  }

  private validateOutgoingForeignKeys(table: Table, proposedRows: readonly StoredRow[]): void {
    for (const foreignKey of table.foreignKeys) {
      const referencedTable = this.resolveReferencedTable(table, foreignKey.referencedTableName);
      const referencedColumn = this.resolveReferencedColumn({
        tableName: table.name,
        columnName: foreignKey.columnName,
        referencedTable,
        referencedColumnName: foreignKey.referencedColumnName
      });
      const referencedRows = this.isSameTable(table, referencedTable) ? proposedRows : referencedTable.getRows();

      for (const row of proposedRows) {
        const value = row[foreignKey.columnName] ?? null;
        if (value === null) {
          continue;
        }

        if (!this.hasMatchingValue(referencedRows, referencedColumn.name, value)) {
          throw new StorageError({
            code: "FOREIGN_KEY_VIOLATION",
            message: `Foreign key violation: ${table.name}.${foreignKey.columnName} references ${referencedTable.name}.${referencedColumn.name}.`,
            tableName: table.name,
            columnName: foreignKey.columnName,
            value,
            referencedTableName: referencedTable.name,
            referencedColumnName: referencedColumn.name
          });
        }
      }
    }
  }

  private validateIncomingReferences(table: Table, proposedRows: readonly StoredRow[]): void {
    for (const referencingTable of this.tables.values()) {
      const referencingRows = this.isSameTable(table, referencingTable) ? proposedRows : referencingTable.getRows();

      for (const foreignKey of referencingTable.foreignKeys) {
        const referencedTable = this.resolveReferencedTable(referencingTable, foreignKey.referencedTableName);
        if (!this.isSameTable(table, referencedTable)) {
          continue;
        }

        const referencedColumn = this.resolveReferencedColumn({
          tableName: referencingTable.name,
          columnName: foreignKey.columnName,
          referencedTable,
          referencedColumnName: foreignKey.referencedColumnName
        });

        for (const row of referencingRows) {
          const value = row[foreignKey.columnName] ?? null;
          if (value === null) {
            continue;
          }

          if (!this.hasMatchingValue(proposedRows, referencedColumn.name, value)) {
            throw new StorageError({
              code: "REFERENCED_ROW_EXISTS",
              message: `Cannot change ${table.name}.${referencedColumn.name} value ${this.describeValue(value)} because ${referencingTable.name}.${foreignKey.columnName} still references it.`,
              tableName: table.name,
              columnName: referencedColumn.name,
              value,
              referencingTableName: referencingTable.name,
              referencingColumnName: foreignKey.columnName
            });
          }
        }
      }
    }
  }

  private resolveReferencedTable(localTable: Table, referencedTableName: string): Table {
    if (this.normalizeTableName(localTable.name) === this.normalizeTableName(referencedTableName)) {
      return localTable;
    }

    const referencedTable = this.tables.get(this.normalizeTableName(referencedTableName));
    if (referencedTable === undefined) {
      throw new StorageError({
        code: "REFERENCED_TABLE_NOT_FOUND",
        message: `Referenced table "${referencedTableName}" was not found.`,
        tableName: localTable.name,
        referencedTableName
      });
    }

    return referencedTable;
  }

  private resolveReferencedColumn(options: {
    tableName: string;
    columnName: string;
    referencedTable: Table;
    referencedColumnName: string;
  }): ReturnType<Table["getColumn"]> {
    try {
      return options.referencedTable.getColumn(options.referencedColumnName);
    } catch {
      throw new StorageError({
        code: "REFERENCED_COLUMN_NOT_FOUND",
        message: `Referenced column "${options.referencedColumnName}" was not found in table "${options.referencedTable.name}".`,
        tableName: options.tableName,
        columnName: options.columnName,
        referencedTableName: options.referencedTable.name,
        referencedColumnName: options.referencedColumnName
      });
    }
  }

  private hasMatchingValue(rows: readonly StoredRow[], columnName: string, value: DatabaseValue): boolean {
    return rows.some((row) => Object.is(row[columnName], value));
  }

  private isSameTable(left: Table, right: Table): boolean {
    return this.normalizeTableName(left.name) === this.normalizeTableName(right.name);
  }

  private describeValue(value: DatabaseValue): string {
    if (value === null) {
      return "NULL";
    }

    return JSON.stringify(value);
  }

  private validateTableName(name: string): void {
    if (name.trim().length === 0) {
      throw new StorageError({
        code: "INVALID_TABLE_NAME",
        message: "Table name must not be empty",
        tableName: name
      });
    }
  }

  private normalizeTableName(name: string): string {
    return name.toLowerCase();
  }

  public getPersistenceDirtySnapshot(): boolean {
    return this.persistenceMetadata.dirty;
  }

  public restorePersistenceDirtySnapshot(dirty: boolean): void {
    this.persistenceMetadata = {
      ...this.persistenceMetadata,
      dirty
    };
  }

  private markDirty(): void {
    if (this.persistenceManager === undefined) {
      return;
    }

    this.persistenceMetadata = {
      ...this.persistenceMetadata,
      dirty: true
    };
  }

  private markClean(bytesWritten: number | null): void {
    this.persistenceMetadata = {
      ...this.persistenceMetadata,
      lastSavedAt: new Date().toISOString(),
      lastSavedBytes: bytesWritten,
      dirty: false
    };
  }
}
