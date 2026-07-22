import type { DatabaseSchemaView } from "../features/schema/schemaTypes";
import type { KansoExecutionResult, KansoScriptExecutionResult } from "../features/execution/executionTypes";

export interface KansoClient {
  execute(sql: string): Promise<KansoExecutionResult>;
  executeScript(
    sql: string,
    options?: {
      stopOnError?: boolean;
      atomic?: boolean;
    }
  ): Promise<KansoScriptExecutionResult>;
  getSchema(): Promise<DatabaseSchemaView>;
}
