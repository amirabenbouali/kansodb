import type { DatabaseSchemaView } from "../features/schema/schemaTypes";
import type { KansoExecutionResult, KansoScriptExecutionResult } from "../features/execution/executionTypes";
import type { KansoExecutionWithTrace, KansoScriptExecutionWithTrace } from "./tracing/traceTypes";

export type AutoSaveModeView = "off" | "on-commit" | "after-mutation";
export type TransactionStateView = "IDLE" | "ACTIVE";
export type DatabaseStorageKind = "memory" | "browser-file";

export interface PersistenceCapabilitiesView {
  runtime: "browser";
  directFilePaths: boolean;
  fileSystemAccessApi: boolean;
  importExportFallback: boolean;
  description: string;
}

export interface PersistenceStateView {
  storageKind: DatabaseStorageKind;
  databaseName: string;
  path: string | null;
  dirty: boolean;
  lastSavedAt: string | null;
  lastSavedBytes: number | null;
  autoSave: AutoSaveModeView;
  capabilities: PersistenceCapabilitiesView;
  knownDatabases: string[];
}

export interface KansoSessionState {
  transactionState: TransactionStateView;
  persistence: PersistenceStateView;
}

export interface KansoClient {
  execute(sql: string): Promise<KansoExecutionResult>;
  executeWithTrace(sql: string): Promise<KansoExecutionWithTrace>;
  executeScript(
    sql: string,
    options?: {
      stopOnError?: boolean;
      atomic?: boolean;
    }
  ): Promise<KansoScriptExecutionResult>;
  executeScriptWithTrace(
    sql: string,
    options?: {
      stopOnError?: boolean;
      atomic?: boolean;
    }
  ): Promise<KansoScriptExecutionWithTrace>;
  createInMemoryDatabase(): Promise<KansoSessionState>;
  createFileBackedDatabase(name: string): Promise<KansoSessionState>;
  openDatabase(name: string): Promise<KansoSessionState>;
  getSessionState(): Promise<KansoSessionState>;
  getSchema(): Promise<DatabaseSchemaView>;
  setAutoSaveMode(mode: AutoSaveModeView): Promise<KansoSessionState>;
}
