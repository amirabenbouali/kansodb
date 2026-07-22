import { executeSqlAsync } from "../../../src/execution/executor.ts";
import { executeSqlScriptAsync } from "../../../src/execution/script-executor.ts";
import type { ScriptExecutionOptions } from "../../../src/execution/script-result.ts";
import type { FileAdapter } from "../../../src/persistence/file-adapter.ts";
import { Database } from "../../../src/storage/database.ts";
import type { DatabaseSchemaView } from "../features/schema/schemaTypes";
import type { KansoExecutionResult, KansoScriptExecutionResult } from "../features/execution/executionTypes";
import type { AutoSaveModeView, KansoClient, KansoSessionState, PersistenceCapabilitiesView } from "./KansoClient";
import { mapKansoError } from "./errorMapper";
import { mapDatabaseSchema, mapScriptResult, mapStatementResult } from "./resultMapper";
import type { ExecutionTrace, KansoExecutionWithTrace, KansoScriptExecutionWithTrace, KansoTracedError } from "./tracing/traceTypes";
import {
  attachTokens,
  collectScriptStorageReads,
  collectStorageReads,
  completeStage,
  createBaseTrace,
  executionFailureStage,
  failTrace,
  lexSql,
  parseScriptTrace,
  parseStatementTrace,
  resultSummary
} from "./tracing/traceMapper";

const DATABASE_NAME = "company.db";
const DATABASE_PATH = "company.db";
const BROWSER_DATABASE_INDEX_KEY = "kansodb.browserDatabases.v1";

export class LocalKansoClient implements KansoClient {
  private databaseReady: Promise<Database>;
  private databaseName = DATABASE_NAME;
  private storageKind: KansoSessionState["persistence"]["storageKind"] = "browser-file";
  private readonly fileAdapter = new BrowserStorageFileAdapter();

  public constructor() {
    rememberBrowserDatabase(DATABASE_PATH);
    this.databaseReady = createSeededDatabase(this.fileAdapter);
  }

  public async execute(sql: string): Promise<KansoExecutionResult> {
    const database = await this.databaseReady;
    const startedAt = performance.now();

    try {
      const result = await executeSqlAsync(database, sql);
      return mapStatementResult(result, database, durationSince(startedAt));
    } catch (error) {
      throw mapKansoError(error);
    }
  }

  public async executeWithTrace(sql: string): Promise<KansoExecutionWithTrace> {
    const database = await this.databaseReady;
    const beforeSnapshot = database.createSnapshot();
    let trace = createBaseTrace(sql);

    try {
      const lexerStartedAt = performance.now();
      const tokens = lexSql(sql);
      trace = attachTokens(trace, tokens);
      trace = completeStage(trace, "lexer", `${tokens.filter((token) => token.type !== "EOF").length} tokens`, durationSince(lexerStartedAt));

      const parserStartedAt = performance.now();
      const parsed = parseStatementTrace(tokens, beforeSnapshot);
      trace = {
        ...completeStage(trace, "parser", parsed.statement.type, durationSince(parserStartedAt)),
        ast: parsed.ast,
        operators: parsed.operators
      };
      trace = completeStage(trace, "ast", parsed.ast.type);

      const executorStartedAt = performance.now();
      const statementResult = await executeSqlAsync(database, sql);
      const executionDurationMs = durationSince(executorStartedAt);
      const result = mapStatementResult(statementResult, database, executionDurationMs);
      trace = completeStage(trace, "executor", result.type, executionDurationMs);

      const afterSnapshot = database.createSnapshot();
      const storageReads = collectStorageReads(parsed.statement, result, beforeSnapshot, afterSnapshot);
      trace = {
        ...completeStage(trace, "storage", storageReads.length === 0 ? "No storage activity recorded" : `${storageReads.length} storage events`),
        storageReads
      };
      trace = {
        ...completeStage(trace, "results", result.type),
        resultSummary: resultSummary(result)
      };

      return { result, trace };
    } catch (error) {
      throw this.tracedError(error, trace);
    }
  }

  public async executeScript(sql: string, options: ScriptExecutionOptions = {}): Promise<KansoScriptExecutionResult> {
    const database = await this.databaseReady;
    try {
      const result = await executeSqlScriptAsync(database, sql, options);
      return mapScriptResult(result, database);
    } catch (error) {
      throw mapKansoError(error);
    }
  }

  public async executeScriptWithTrace(sql: string, options: ScriptExecutionOptions = {}): Promise<KansoScriptExecutionWithTrace> {
    const database = await this.databaseReady;
    const beforeSnapshot = database.createSnapshot();
    let trace = createBaseTrace(sql);

    try {
      const lexerStartedAt = performance.now();
      const tokens = lexSql(sql);
      trace = attachTokens(trace, tokens);
      trace = completeStage(trace, "lexer", `${tokens.filter((token) => token.type !== "EOF").length} tokens`, durationSince(lexerStartedAt));

      const parserStartedAt = performance.now();
      const parsed = parseScriptTrace(tokens, sql, beforeSnapshot);
      trace = {
        ...completeStage(trace, "parser", `${parsed.statements.length} statements`, durationSince(parserStartedAt)),
        ast: parsed.ast,
        operators: parsed.operators
      };
      trace = completeStage(trace, "ast", parsed.ast.type);

      const executorStartedAt = performance.now();
      const scriptResult = await executeSqlScriptAsync(database, sql, options);
      const result = mapScriptResult(scriptResult, database);
      trace = completeStage(trace, "executor", "script", durationSince(executorStartedAt));

      const afterSnapshot = database.createSnapshot();
      const storageReads = collectScriptStorageReads(result, beforeSnapshot, afterSnapshot);
      trace = {
        ...completeStage(trace, "storage", storageReads.length === 0 ? "No storage activity recorded" : `${storageReads.length} storage events`),
        storageReads
      };
      trace = {
        ...completeStage(trace, "results", "script"),
        resultSummary: resultSummary(result)
      };

      if (result.failed > 0 && trace.stages.every((stage) => stage.status !== "failed")) {
        trace = failTrace(trace, "executor", "Script completed with statement errors");
      }

      return { result, trace };
    } catch (error) {
      throw this.tracedError(error, trace);
    }
  }

  public async getSchema(): Promise<DatabaseSchemaView> {
    const database = await this.databaseReady;
    return mapDatabaseSchema(database, this.databaseName);
  }

  public async createInMemoryDatabase(): Promise<KansoSessionState> {
    this.databaseName = "Untitled memory";
    this.storageKind = "memory";
    this.databaseReady = Database.open({ autoSave: "off" });
    return this.getSessionState();
  }

  public async createFileBackedDatabase(name: string): Promise<KansoSessionState> {
    const path = normalizeBrowserDatabaseName(name);
    rememberBrowserDatabase(path);
    this.databaseName = path;
    this.storageKind = "browser-file";
    this.databaseReady = Database.open({
      path,
      fileAdapter: this.fileAdapter,
      autoSave: "off"
    });
    return this.getSessionState();
  }

  public async openDatabase(name: string): Promise<KansoSessionState> {
    const path = normalizeBrowserDatabaseName(name);
    rememberBrowserDatabase(path);
    this.databaseName = path;
    this.storageKind = "browser-file";
    this.databaseReady = Database.open({
      path,
      fileAdapter: this.fileAdapter,
      autoSave: "off"
    });
    return this.getSessionState();
  }

  public async getSessionState(): Promise<KansoSessionState> {
    const database = await this.databaseReady;
    const persistence = database.persistenceState;

    return {
      transactionState: database.transactionState,
      persistence: {
        storageKind: this.storageKind,
        databaseName: this.databaseName,
        path: persistence.path,
        dirty: persistence.dirty,
        lastSavedAt: persistence.lastSavedAt,
        lastSavedBytes: persistence.lastSavedBytes,
        autoSave: database.autoSave,
        capabilities: browserPersistenceCapabilities(),
        knownDatabases: loadKnownBrowserDatabases()
      }
    };
  }

  public async setAutoSaveMode(mode: AutoSaveModeView): Promise<KansoSessionState> {
    const database = await this.databaseReady;
    database.setAutoSave(mode);
    return this.getSessionState();
  }

  private tracedError(error: unknown, trace: ExecutionTrace): KansoTracedError {
    const mappedError = mapKansoError(error);
    const failureStage = executionFailureStage(error);
    const preparedTrace = failureStage === "storage"
      ? completeStage(trace, "executor", "Statement reached storage validation")
      : trace;

    return {
      error: mappedError,
      trace: failTrace(preparedTrace, failureStage, mappedError.code)
    };
  }
}

class BrowserStorageFileAdapter implements FileAdapter {
  private readonly memoryFallback = new Map<string, string>();

  public async exists(path: string): Promise<boolean> {
    return this.readFromStore(path) !== null;
  }

  public async readText(path: string): Promise<string> {
    const contents = this.readFromStore(path);
    if (contents === null) {
      throw new Error(`File "${path}" does not exist.`);
    }

    return contents;
  }

  public async writeText(path: string, contents: string): Promise<void> {
    this.writeToStore(path, contents);
  }

  public async rename(from: string, to: string): Promise<void> {
    const contents = await this.readText(from);
    this.writeToStore(to, contents);
    this.removeFromStore(from);
  }

  public async remove(path: string): Promise<void> {
    this.removeFromStore(path);
  }

  public async ensureDirectory(): Promise<void> {
    return Promise.resolve();
  }

  private readFromStore(path: string): string | null {
    if (!hasLocalStorage()) {
      return this.memoryFallback.get(path) ?? null;
    }

    return window.localStorage.getItem(fileStorageKey(path));
  }

  private writeToStore(path: string, contents: string): void {
    if (!hasLocalStorage()) {
      this.memoryFallback.set(path, contents);
      return;
    }

    window.localStorage.setItem(fileStorageKey(path), contents);
  }

  private removeFromStore(path: string): void {
    if (!hasLocalStorage()) {
      this.memoryFallback.delete(path);
      return;
    }

    window.localStorage.removeItem(fileStorageKey(path));
  }
}

async function createSeededDatabase(fileAdapter: FileAdapter): Promise<Database> {
  const database = await Database.open({
    path: DATABASE_PATH,
    fileAdapter,
    autoSave: "off"
  });

  if (database.listTables().length > 0) {
    return database;
  }

  await executeSqlScriptAsync(database, `
    CREATE TABLE departments (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      active BOOLEAN NOT NULL
    );

    CREATE TABLE employees (
      id INTEGER PRIMARY KEY,
      email TEXT UNIQUE NULL,
      name TEXT NOT NULL,
      department_id INTEGER NULL,
      salary DECIMAL,
      active BOOLEAN NOT NULL,
      FOREIGN KEY (department_id) REFERENCES departments(id)
    );

    CREATE TABLE salaries (
      id INTEGER PRIMARY KEY,
      employee_id INTEGER NOT NULL,
      amount DECIMAL NOT NULL,
      paid_at TEXT NOT NULL,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );

    INSERT INTO departments VALUES (1, 'Engineering', TRUE);
    INSERT INTO departments VALUES (2, 'Design', TRUE);
    INSERT INTO departments VALUES (3, 'Operations', FALSE);

    INSERT INTO employees VALUES (1, 'amira@example.com', 'Amira', 1, 48000, TRUE);
    INSERT INTO employees VALUES (2, 'maya@example.com', 'Maya', 2, 42000.5, TRUE);
    INSERT INTO employees VALUES (3, NULL, 'Noah', 1, 52000, FALSE);
    INSERT INTO employees VALUES (4, NULL, 'Lina', NULL, 45000, TRUE);

    INSERT INTO salaries VALUES (1, 1, 48000, '2026-01-31');
    INSERT INTO salaries VALUES (2, 2, 42000.5, '2026-01-31');
    INSERT INTO salaries VALUES (3, 3, 52000, '2026-01-31');
    INSERT INTO salaries VALUES (4, 4, 45000, '2026-01-31');
  `, { atomic: true });

  return database;
}

function durationSince(startedAt: number): number {
  return Math.max(0, performance.now() - startedAt);
}

function browserPersistenceCapabilities(): PersistenceCapabilitiesView {
  return {
    runtime: "browser",
    directFilePaths: false,
    fileSystemAccessApi: typeof window !== "undefined" && "showOpenFilePicker" in window,
    importExportFallback: true,
    description: "This frontend runs in the browser. KansoDB stores file-backed databases in browser local storage and can later add import/export around that adapter; native Node filesystem paths are not used here."
  };
}

function fileStorageKey(path: string): string {
  return `kansodb.browserFile.${path}`;
}

function hasLocalStorage(): boolean {
  return typeof window !== "undefined" && window.localStorage !== undefined;
}

function normalizeBrowserDatabaseName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return `database-${Date.now()}.db.json`;
  }

  return trimmed.includes(".") ? trimmed : `${trimmed}.db.json`;
}

function loadKnownBrowserDatabases(): string[] {
  if (!hasLocalStorage()) {
    return [DATABASE_PATH];
  }

  try {
    const raw = window.localStorage.getItem(BROWSER_DATABASE_INDEX_KEY);
    const parsed: unknown = raw === null ? null : JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [DATABASE_PATH];
    }

    const names = parsed.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    return names.length === 0 ? [DATABASE_PATH] : [...new Set(names)];
  } catch {
    return [DATABASE_PATH];
  }
}

function rememberBrowserDatabase(path: string): void {
  if (!hasLocalStorage()) {
    return;
  }

  const names = new Set(loadKnownBrowserDatabases());
  names.add(path);
  window.localStorage.setItem(BROWSER_DATABASE_INDEX_KEY, JSON.stringify([...names]));
}
