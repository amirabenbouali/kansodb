import { PersistenceError } from "../errors/persistence-error.js";
import type { DatabaseSnapshot } from "../storage/transaction.js";
import { DatabaseCodec } from "./database-codec.js";
import type { FileAdapter } from "./file-adapter.js";

export interface SaveResult {
  path: string;
  bytesWritten: number;
}

export class PersistenceManager {
  private readonly path: string;
  private readonly temporaryPath: string;
  private readonly backupPath: string;
  private readonly fileAdapter: FileAdapter;
  private readonly codec: DatabaseCodec;

  public constructor(path: string, fileAdapter: FileAdapter, codec: DatabaseCodec) {
    if (path.trim().length === 0) {
      throw new PersistenceError({
        code: "PERSISTENCE_PATH_NOT_CONFIGURED",
        message: "Persistence path must not be empty."
      });
    }

    this.path = path;
    this.temporaryPath = `${path}.tmp`;
    this.backupPath = `${path}.bak`;
    this.fileAdapter = fileAdapter;
    this.codec = codec;
  }

  public async load(): Promise<DatabaseSnapshot | null> {
    await this.recover();

    if (!(await this.fileAdapter.exists(this.path))) {
      return null;
    }

    const contents = await this.fileAdapter.readText(this.path);
    try {
      return this.codec.decode(contents);
    } catch (error) {
      throw this.withPath(error, this.path);
    }
  }

  public async save(snapshot: DatabaseSnapshot): Promise<SaveResult> {
    await this.recover();
    const payload = this.codec.encode(snapshot);
    const bytesWritten = Buffer.byteLength(payload, "utf8");

    try {
      await this.fileAdapter.ensureDirectory(this.path);
      await this.fileAdapter.writeText(this.temporaryPath, payload);
      await this.fileAdapter.syncFile?.(this.temporaryPath);

      if (await this.fileAdapter.exists(this.path)) {
        await this.fileAdapter.remove(this.backupPath);
        await this.fileAdapter.rename(this.path, this.backupPath);
      }

      try {
        await this.fileAdapter.rename(this.temporaryPath, this.path);
      } catch (error) {
        if (await this.fileAdapter.exists(this.backupPath)) {
          await this.fileAdapter.rename(this.backupPath, this.path);
        }
        throw error;
      }

      await this.fileAdapter.syncDirectory?.(this.path);
      await this.fileAdapter.remove(this.backupPath);
    } catch (error) {
      if (error instanceof PersistenceError) {
        throw error;
      }

      throw new PersistenceError({
        code: "PERSISTENCE_WRITE_FAILED",
        message: `Failed to save database file "${this.path}".`,
        path: this.path
      });
    }

    return {
      path: this.path,
      bytesWritten
    };
  }

  public async recover(): Promise<void> {
    const finalExists = await this.fileAdapter.exists(this.path);
    const tempExists = await this.fileAdapter.exists(this.temporaryPath);
    const backupExists = await this.fileAdapter.exists(this.backupPath);

    if (finalExists && !tempExists && !backupExists) {
      return;
    }

    if (!finalExists && backupExists && !tempExists) {
      await this.promote(this.backupPath, this.path);
      return;
    }

    if (!finalExists && tempExists && !backupExists) {
      if (await this.isValid(this.temporaryPath)) {
        await this.promote(this.temporaryPath, this.path);
      } else {
        await this.fileAdapter.remove(this.temporaryPath);
      }
      return;
    }

    if (finalExists && backupExists && !tempExists) {
      if (await this.isValid(this.path)) {
        await this.fileAdapter.remove(this.backupPath);
        return;
      }

      if (await this.isValid(this.backupPath)) {
        await this.fileAdapter.remove(this.path);
        await this.promote(this.backupPath, this.path);
        return;
      }

      throw this.recoveryFailed("Both final and backup database files are invalid.");
    }

    if (finalExists && tempExists) {
      if (await this.isValid(this.path)) {
        await this.fileAdapter.remove(this.temporaryPath);
        if (backupExists) {
          await this.fileAdapter.remove(this.backupPath);
        }
        return;
      }

      if (await this.isValid(this.temporaryPath)) {
        await this.fileAdapter.remove(this.path);
        await this.promote(this.temporaryPath, this.path);
        if (backupExists) {
          await this.fileAdapter.remove(this.backupPath);
        }
        return;
      }

      if (backupExists && await this.isValid(this.backupPath)) {
        await this.fileAdapter.remove(this.path);
        await this.fileAdapter.remove(this.temporaryPath);
        await this.promote(this.backupPath, this.path);
        return;
      }

      throw this.recoveryFailed("No valid database file candidate was available.");
    }

    if (!finalExists && tempExists && backupExists) {
      if (await this.isValid(this.temporaryPath)) {
        await this.promote(this.temporaryPath, this.path);
        await this.fileAdapter.remove(this.backupPath);
        return;
      }

      await this.fileAdapter.remove(this.temporaryPath);
      if (await this.isValid(this.backupPath)) {
        await this.promote(this.backupPath, this.path);
        return;
      }

      throw this.recoveryFailed("Temporary and backup database files are invalid.");
    }
  }

  private async isValid(path: string): Promise<boolean> {
    try {
      this.codec.decode(await this.fileAdapter.readText(path));
      return true;
    } catch {
      return false;
    }
  }

  private async promote(from: string, to: string): Promise<void> {
    await this.fileAdapter.ensureDirectory(to);
    await this.fileAdapter.rename(from, to);
  }

  private recoveryFailed(message: string): PersistenceError {
    return new PersistenceError({
      code: "PERSISTENCE_RECOVERY_FAILED",
      message,
      path: this.path
    });
  }

  private withPath(error: unknown, path: string): PersistenceError {
    if (error instanceof PersistenceError) {
      const options = {
        code: error.code,
        message: error.message,
        path,
        ...(error.tableName === undefined ? {} : { tableName: error.tableName }),
        ...(error.columnName === undefined ? {} : { columnName: error.columnName }),
        ...(error.rowIndex === undefined ? {} : { rowIndex: error.rowIndex }),
        ...(error.foundVersion === undefined ? {} : { foundVersion: error.foundVersion }),
        ...(error.supportedVersions === undefined ? {} : { supportedVersions: error.supportedVersions })
      };
      return new PersistenceError(options);
    }

    return new PersistenceError({
      code: "PERSISTENCE_READ_FAILED",
      message: `Failed to load database file "${path}".`,
      path
    });
  }
}
