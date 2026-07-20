import type { QueryResult } from "./query-result.js";

export type StatementResult = QueryResult | CreateTableResult | InsertResult;

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
