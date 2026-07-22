import type { DatabaseSchemaView } from "./schemaTypes";

export interface SchemaProvider {
  getSchema(): Promise<DatabaseSchemaView>;
}
