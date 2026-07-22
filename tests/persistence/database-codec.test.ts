import { describe, expect, it } from "vitest";
import {
  CURRENT_STORAGE_FORMAT_VERSION,
  Database,
  DatabaseCodec,
  DataType,
  PersistenceError
} from "../../src/index.js";

function createSnapshot() {
  const database = new Database();
  database.createTable("departments", [
    { name: "id", type: DataType.INTEGER, primaryKey: true },
    { name: "name", type: DataType.TEXT, unique: true }
  ]);
  database.createTable("employees", [
    { name: "id", type: DataType.INTEGER, primaryKey: true },
    { name: "name", type: DataType.TEXT },
    { name: "department_id", type: DataType.INTEGER, nullable: true, references: { tableName: "departments", columnName: "id" } },
    { name: "salary", type: DataType.DECIMAL, nullable: true },
    { name: "active", type: DataType.BOOLEAN }
  ]);
  database.insertInto("departments", { id: 1, name: "Engineering" });
  database.insertInto("employees", { id: 1, name: "Amira", department_id: 1, salary: 48000.5, active: true });
  database.insertInto("employees", { id: 2, name: "Lina", department_id: null, salary: null, active: false });
  return database.createSnapshot();
}

function expectPersistenceError(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error("Expected persistence action to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(PersistenceError);
    expect(error).toMatchObject({ code });
  }
}

describe("DatabaseCodec", () => {
  it("encodes empty databases deterministically with a final newline", () => {
    const codec = new DatabaseCodec();
    const first = codec.encode({ tables: [] }, { savedAt: "2026-07-22T00:00:00.000Z" });
    const second = codec.encode({ tables: [] }, { savedAt: "2026-07-22T00:00:00.000Z" });

    expect(first).toBe(second);
    expect(first.endsWith("\n")).toBe(true);
    expect(JSON.parse(first)).toEqual({
      format: "kansodb",
      version: CURRENT_STORAGE_FORMAT_VERSION,
      savedAt: "2026-07-22T00:00:00.000Z",
      database: { tables: [] }
    });
  });

  it("round-trips tables, rows, order, and constraints", () => {
    const codec = new DatabaseCodec();
    const decoded = codec.decode(codec.encode(createSnapshot(), { savedAt: "2026-07-22T00:00:00.000Z" }));

    expect(decoded.tables.map((table) => table.name)).toEqual(["departments", "employees"]);
    expect(decoded.tables[1]).toMatchObject({
      name: "employees",
      primaryKey: { columnName: "id" },
      foreignKeys: [
        { columnName: "department_id", referencedTableName: "departments", referencedColumnName: "id" }
      ],
      rows: [
        { id: 1, name: "Amira", department_id: 1, salary: 48000.5, active: true },
        { id: 2, name: "Lina", department_id: null, salary: null, active: false }
      ]
    });
  });

  it("rejects malformed JSON, wrong format, and unsupported versions", () => {
    const codec = new DatabaseCodec();

    expectPersistenceError(() => codec.decode("{"), "PERSISTENCE_FILE_CORRUPT");
    expectPersistenceError(() => codec.decode(JSON.stringify({ format: "other", version: 1, savedAt: "", database: { tables: [] } })), "INVALID_STORAGE_FORMAT");
    expectPersistenceError(() => codec.decode(JSON.stringify({ format: "kansodb", version: 999, savedAt: "", database: { tables: [] } })), "UNSUPPORTED_STORAGE_VERSION");
  });

  it("rejects invalid rows and constraints", () => {
    const codec = new DatabaseCodec();
    const file = JSON.parse(codec.encode(createSnapshot(), { savedAt: "2026-07-22T00:00:00.000Z" }));
    file.database.tables[1].rows[0].id = 1.5;
    expectPersistenceError(() => codec.decode(JSON.stringify(file)), "INVALID_PERSISTED_ROW");

    const duplicate = JSON.parse(codec.encode(createSnapshot(), { savedAt: "2026-07-22T00:00:00.000Z" }));
    duplicate.database.tables[1].rows[1].id = 1;
    expectPersistenceError(() => codec.decode(JSON.stringify(duplicate)), "INVALID_PERSISTED_CONSTRAINT");

    const missingParent = JSON.parse(codec.encode(createSnapshot(), { savedAt: "2026-07-22T00:00:00.000Z" }));
    missingParent.database.tables[1].rows[0].department_id = 999;
    expectPersistenceError(() => codec.decode(JSON.stringify(missingParent)), "INVALID_PERSISTED_ROW");
  });
});
