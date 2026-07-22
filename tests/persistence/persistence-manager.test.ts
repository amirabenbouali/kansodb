import { describe, expect, it } from "vitest";
import { Database, DatabaseCodec, DataType, PersistenceError, PersistenceManager, type FileAdapter } from "../../src/index.js";

class MemoryFileAdapter implements FileAdapter {
  public readonly files = new Map<string, string>();
  public failWrite = false;
  public failPromotion = false;

  public async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  public async readText(path: string): Promise<string> {
    const value = this.files.get(path);
    if (value === undefined) {
      throw new PersistenceError({ code: "PERSISTENCE_READ_FAILED", message: "Missing file", path });
    }
    return value;
  }

  public async writeText(path: string, contents: string): Promise<void> {
    if (this.failWrite) {
      throw new PersistenceError({ code: "PERSISTENCE_WRITE_FAILED", message: "Injected write failure", path });
    }
    this.files.set(path, contents);
  }

  public async rename(from: string, to: string): Promise<void> {
    if (this.failPromotion && from.endsWith(".tmp")) {
      throw new PersistenceError({ code: "PERSISTENCE_RENAME_FAILED", message: "Injected rename failure", path: to });
    }

    const value = this.files.get(from);
    if (value === undefined) {
      throw new PersistenceError({ code: "PERSISTENCE_RENAME_FAILED", message: "Missing source", path: to });
    }
    this.files.delete(from);
    this.files.set(to, value);
  }

  public async remove(path: string): Promise<void> {
    this.files.delete(path);
  }

  public async ensureDirectory(): Promise<void> {
    return;
  }
}

function snapshot() {
  const database = new Database();
  database.createTable("accounts", [{ name: "id", type: DataType.INTEGER, primaryKey: true }]);
  database.insertInto("accounts", { id: 1 });
  return database.createSnapshot();
}

describe("PersistenceManager", () => {
  it("loads missing files as null and saves valid snapshots", async () => {
    const adapter = new MemoryFileAdapter();
    const manager = new PersistenceManager("db.json", adapter, new DatabaseCodec());

    await expect(manager.load()).resolves.toBeNull();
    const result = await manager.save(snapshot());

    expect(result.path).toBe("db.json");
    expect(result.bytesWritten).toBeGreaterThan(0);
    expect(adapter.files.has("db.json")).toBe(true);
    expect(adapter.files.has("db.json.tmp")).toBe(false);
    expect(adapter.files.has("db.json.bak")).toBe(false);
    await expect(manager.load()).resolves.toMatchObject({ tables: [{ name: "accounts" }] });
  });

  it("preserves final file on temporary write failure", async () => {
    const adapter = new MemoryFileAdapter();
    const codec = new DatabaseCodec();
    const manager = new PersistenceManager("db.json", adapter, codec);
    await manager.save(snapshot());
    const original = adapter.files.get("db.json");

    adapter.failWrite = true;
    await expect(manager.save(snapshot())).rejects.toMatchObject({ code: "PERSISTENCE_WRITE_FAILED" });
    expect(adapter.files.get("db.json")).toBe(original);
  });

  it("restores backup when final is missing", async () => {
    const adapter = new MemoryFileAdapter();
    const codec = new DatabaseCodec();
    adapter.files.set("db.json.bak", codec.encode(snapshot(), { savedAt: "2026-07-22T00:00:00.000Z" }));
    const manager = new PersistenceManager("db.json", adapter, codec);

    await manager.recover();

    expect(adapter.files.has("db.json")).toBe(true);
    expect(adapter.files.has("db.json.bak")).toBe(false);
  });

  it("promotes valid temporary files and rejects all-invalid candidates", async () => {
    const adapter = new MemoryFileAdapter();
    const codec = new DatabaseCodec();
    adapter.files.set("db.json.tmp", codec.encode(snapshot(), { savedAt: "2026-07-22T00:00:00.000Z" }));
    await new PersistenceManager("db.json", adapter, codec).recover();
    expect(adapter.files.has("db.json")).toBe(true);

    const invalid = new MemoryFileAdapter();
    invalid.files.set("broken.json", "{");
    invalid.files.set("broken.json.tmp", "{");
    invalid.files.set("broken.json.bak", "{");
    await expect(new PersistenceManager("broken.json", invalid, codec).recover()).rejects.toMatchObject({
      code: "PERSISTENCE_RECOVERY_FAILED"
    });
  });
});
