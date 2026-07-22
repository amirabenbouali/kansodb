import type { Statement } from "../parser/ast.js";

export type PersistenceErrorCode =
  | "PERSISTENCE_PATH_NOT_CONFIGURED"
  | "PERSISTENCE_READ_FAILED"
  | "PERSISTENCE_WRITE_FAILED"
  | "PERSISTENCE_RENAME_FAILED"
  | "PERSISTENCE_REMOVE_FAILED"
  | "PERSISTENCE_RECOVERY_FAILED"
  | "PERSISTENCE_FILE_CORRUPT"
  | "INVALID_STORAGE_FORMAT"
  | "UNSUPPORTED_STORAGE_VERSION"
  | "INVALID_PERSISTED_SCHEMA"
  | "INVALID_PERSISTED_ROW"
  | "INVALID_PERSISTED_CONSTRAINT"
  | "SAVE_DURING_ACTIVE_TRANSACTION"
  | "TEMPORARY_FILE_INVALID"
  | "BACKUP_FILE_INVALID"
  | "AUTO_SAVE_FAILED";

export interface PersistenceErrorOptions {
  code: PersistenceErrorCode;
  message: string;
  path?: string;
  tableName?: string;
  columnName?: string;
  rowIndex?: number;
  foundVersion?: number;
  supportedVersions?: readonly number[];
  statementType?: Statement["type"];
  databaseStateCommitted?: boolean;
  persistenceSucceeded?: boolean;
}

export class PersistenceError extends Error {
  public readonly code: PersistenceErrorCode;
  public readonly path?: string;
  public readonly tableName?: string;
  public readonly columnName?: string;
  public readonly rowIndex?: number;
  public readonly foundVersion?: number;
  public readonly supportedVersions?: readonly number[];
  public readonly statementType?: Statement["type"];
  public readonly databaseStateCommitted?: boolean;
  public readonly persistenceSucceeded?: boolean;

  public constructor(options: PersistenceErrorOptions) {
    super(options.message);
    this.name = "PersistenceError";
    this.code = options.code;

    if (options.path !== undefined) this.path = options.path;
    if (options.tableName !== undefined) this.tableName = options.tableName;
    if (options.columnName !== undefined) this.columnName = options.columnName;
    if (options.rowIndex !== undefined) this.rowIndex = options.rowIndex;
    if (options.foundVersion !== undefined) this.foundVersion = options.foundVersion;
    if (options.supportedVersions !== undefined) this.supportedVersions = [...options.supportedVersions];
    if (options.statementType !== undefined) this.statementType = options.statementType;
    if (options.databaseStateCommitted !== undefined) this.databaseStateCommitted = options.databaseStateCommitted;
    if (options.persistenceSucceeded !== undefined) this.persistenceSucceeded = options.persistenceSucceeded;
  }
}
