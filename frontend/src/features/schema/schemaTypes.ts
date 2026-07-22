export interface DatabaseSchemaView {
  databaseName: string;
  tables: TableSchemaView[];
}

export interface TableSchemaView {
  columns: ColumnSchemaView[];
  name: string;
  rowCount: number;
}

export interface ColumnSchemaView {
  dataType: string;
  foreignKey?: {
    columnName: string;
    tableName: string;
  };
  name: string;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
}

export type SchemaLoadMode = "loaded" | "empty" | "error";
