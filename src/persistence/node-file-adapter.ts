import { open, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { PersistenceError } from "../errors/persistence-error.js";
import type { FileAdapter } from "./file-adapter.js";

export class NodeFileAdapter implements FileAdapter {
  public async exists(path: string): Promise<boolean> {
    try {
      await readFile(path);
      return true;
    } catch (error) {
      if (this.isNodeError(error) && error.code === "ENOENT") {
        return false;
      }
      throw new PersistenceError({
        code: "PERSISTENCE_READ_FAILED",
        message: `Failed to check whether "${path}" exists.`,
        path
      });
    }
  }

  public async readText(path: string): Promise<string> {
    try {
      return await readFile(path, "utf8");
    } catch {
      throw new PersistenceError({
        code: "PERSISTENCE_READ_FAILED",
        message: `Failed to read database file "${path}".`,
        path
      });
    }
  }

  public async writeText(path: string, contents: string): Promise<void> {
    try {
      await writeFile(path, contents, "utf8");
    } catch {
      throw new PersistenceError({
        code: "PERSISTENCE_WRITE_FAILED",
        message: `Failed to write database file "${path}".`,
        path
      });
    }
  }

  public async rename(from: string, to: string): Promise<void> {
    try {
      await rename(from, to);
    } catch {
      throw new PersistenceError({
        code: "PERSISTENCE_RENAME_FAILED",
        message: `Failed to rename database file "${from}".`,
        path: to
      });
    }
  }

  public async remove(path: string): Promise<void> {
    try {
      await rm(path, { force: true });
    } catch {
      throw new PersistenceError({
        code: "PERSISTENCE_REMOVE_FAILED",
        message: `Failed to remove database file "${path}".`,
        path
      });
    }
  }

  public async ensureDirectory(path: string): Promise<void> {
    try {
      await mkdir(dirname(path), { recursive: true });
    } catch {
      throw new PersistenceError({
        code: "PERSISTENCE_WRITE_FAILED",
        message: `Failed to create parent directory for "${path}".`,
        path
      });
    }
  }

  public async syncFile(path: string): Promise<void> {
    const handle = await open(path, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  }

  public async syncDirectory(path: string): Promise<void> {
    const handle = await open(dirname(path), "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  }

  private isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return typeof error === "object" && error !== null && "code" in error;
  }
}
