import type { DatabaseValue } from "../storage/row.js";

export interface QueryResult {
  type: "query";
  columns: string[];
  rows: Record<string, DatabaseValue>[];
  rowCount: number;
}
