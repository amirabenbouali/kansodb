import { StorageError } from "../errors/storage-error.js";
import type { ColumnDefinition } from "./column.js";
import { Table } from "./table.js";

export class Database {
  private readonly tables = new Map<string, Table>();

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

    const table = new Table(name, columns);
    this.tables.set(key, table);
    return table;
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

  public dropTable(name: string): void {
    const key = this.normalizeTableName(name);

    if (!this.tables.delete(key)) {
      throw new StorageError({
        code: "TABLE_NOT_FOUND",
        message: `Table "${name}" was not found`,
        tableName: name
      });
    }
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
}
