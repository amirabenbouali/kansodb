import type { DataType } from "../storage/data-type.js";
import type { DatabaseValue } from "../storage/row.js";

export const CURRENT_STORAGE_FORMAT_VERSION = 1;
export const STORAGE_FORMAT_NAME = "kansodb";

export interface PersistedDatabaseFile {
  format: typeof STORAGE_FORMAT_NAME;
  version: number;
  savedAt: string;
  database: PersistedDatabase;
}

export interface PersistedDatabase {
  tables: PersistedTable[];
}

export interface PersistedTable {
  name: string;
  columns: PersistedColumn[];
  primaryKey?: PersistedPrimaryKey;
  uniqueConstraints: PersistedUniqueConstraint[];
  foreignKeys: PersistedForeignKey[];
  rows: PersistedRow[];
}

export interface PersistedColumn {
  name: string;
  dataType: DataType;
  nullable: boolean;
}

export interface PersistedPrimaryKey {
  columnName: string;
}

export interface PersistedUniqueConstraint {
  columnName: string;
}

export interface PersistedForeignKey {
  columnName: string;
  referencedTableName: string;
  referencedColumnName: string;
}

export type PersistedRow = Record<string, DatabaseValue>;
