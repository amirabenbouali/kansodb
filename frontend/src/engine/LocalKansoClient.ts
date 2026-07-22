import { executeSqlAsync } from "../../../src/execution/executor.ts";
import { executeSqlScriptAsync } from "../../../src/execution/script-executor.ts";
import type { ScriptExecutionOptions } from "../../../src/execution/script-result.ts";
import type { FileAdapter } from "../../../src/persistence/file-adapter.ts";
import { Database } from "../../../src/storage/database.ts";
import type { DatabaseSchemaView } from "../features/schema/schemaTypes";
import type { KansoExecutionResult, KansoScriptExecutionResult } from "../features/execution/executionTypes";
import type { KansoClient } from "./KansoClient";
import { mapKansoError } from "./errorMapper";
import { mapDatabaseSchema, mapScriptResult, mapStatementResult } from "./resultMapper";

const DATABASE_NAME = "company.db";
const DATABASE_PATH = "company.db";

export class LocalKansoClient implements KansoClient {
  private readonly databaseReady: Promise<Database>;

  public constructor() {
    this.databaseReady = createSeededDatabase();
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

  public async executeScript(sql: string, options: ScriptExecutionOptions = {}): Promise<KansoScriptExecutionResult> {
    const database = await this.databaseReady;
    const result = await executeSqlScriptAsync(database, sql, options);
    return mapScriptResult(result, database);
  }

  public async getSchema(): Promise<DatabaseSchemaView> {
    const database = await this.databaseReady;
    return mapDatabaseSchema(database, DATABASE_NAME);
  }
}

class BrowserMemoryFileAdapter implements FileAdapter {
  private readonly files = new Map<string, string>();

  public async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  public async readText(path: string): Promise<string> {
    const contents = this.files.get(path);
    if (contents === undefined) {
      throw new Error(`File "${path}" does not exist.`);
    }

    return contents;
  }

  public async writeText(path: string, contents: string): Promise<void> {
    this.files.set(path, contents);
  }

  public async rename(from: string, to: string): Promise<void> {
    const contents = await this.readText(from);
    this.files.set(to, contents);
    this.files.delete(from);
  }

  public async remove(path: string): Promise<void> {
    this.files.delete(path);
  }

  public async ensureDirectory(): Promise<void> {
    return Promise.resolve();
  }
}

async function createSeededDatabase(): Promise<Database> {
  const database = await Database.open({
    path: DATABASE_PATH,
    fileAdapter: new BrowserMemoryFileAdapter(),
    autoSave: "off"
  });

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
