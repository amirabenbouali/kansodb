import type { QueryTabExecutionSnapshot } from "../execution/executionTypes";

export interface QueryTab {
  id: string;
  title: string;
  sql: string;
  isDirty: boolean;
  createdAt: number;
  updatedAt: number;
  execution: QueryTabExecutionSnapshot | null;
}

export interface EditorInsertionRequest {
  id: number;
  text: string;
}
