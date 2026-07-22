export interface ForeignKeyReference {
  tableName: string;
  columnName: string;
}

export interface ForeignKeyMetadata {
  columnName: string;
  referencedTableName: string;
  referencedColumnName: string;
}
