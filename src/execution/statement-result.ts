import type { QueryResult } from "./query-result.js";

export type StatementResult = QueryResult | CreateTableResult | InsertResult | UpdateResult | DeleteResult;

export interface CreateTableResult {
  type: "create_table";
  tableName: string;
  columnCount: number;
}

export interface InsertResult {
  type: "insert";
  tableName: string;
  affectedRows: 1;
}

export interface UpdateResult {
  type: "update";
  tableName: string;
  affectedRows: number;
}

export interface DeleteResult {
  type: "delete";
  tableName: string;
  affectedRows: number;
}
