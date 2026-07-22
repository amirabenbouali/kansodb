import { describe, expect, it } from "vitest";
import { Database, DataType, StorageError, type ColumnDefinition } from "../../src/index.js";

function expectStorageError(action: () => unknown, code: string): StorageError {
  try {
    action();
    throw new Error("Expected storage action to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(StorageError);
    expect(error).toMatchObject({ code });
    return error as StorageError;
  }
}

function createDepartmentDatabase(): Database {
  const database = new Database();
  database.createTable("departments", [
    { name: "id", type: DataType.INTEGER, primaryKey: true },
    { name: "code", type: DataType.TEXT, unique: true },
    { name: "active", type: DataType.BOOLEAN, unique: true, nullable: true }
  ]);
  database.createTable("employees", [
    { name: "id", type: DataType.INTEGER, primaryKey: true },
    { name: "name", type: DataType.TEXT },
    { name: "department_id", type: DataType.INTEGER, nullable: true, references: { tableName: "departments", columnName: "id" } }
  ]);
  return database;
}

describe("primary key and unique constraints", () => {
  it("exposes primary-key and unique metadata", () => {
    const database = new Database();
    const table = database.createTable("users", [
      { name: "id", type: DataType.INTEGER, primaryKey: true },
      { name: "email", type: DataType.TEXT, unique: true, nullable: true }
    ]);

    expect(table.primaryKey).toEqual({ columnName: "id" });
    expect(table.uniqueConstraints).toEqual([{ columnName: "id" }, { columnName: "email" }]);
    expect(table.getColumn("id")).toMatchObject({ nullable: false, unique: true, primaryKey: true });
  });

  it("rejects duplicate and null primary-key values", () => {
    const database = new Database();
    database.createTable("users", [{ name: "id", type: DataType.INTEGER, primaryKey: true }]);
    database.insertInto("users", { id: 1 });

    expectStorageError(() => database.insertInto("users", { id: 1 }), "PRIMARY_KEY_VIOLATION");
    expectStorageError(() => database.insertInto("users", { id: null }), "NOT_NULL_VIOLATION");
  });

  it("rejects duplicate unique values but allows multiple nulls", () => {
    const database = new Database();
    database.createTable("users", [{ name: "email", type: DataType.TEXT, unique: true, nullable: true }]);
    database.insertInto("users", { email: null });
    database.insertInto("users", { email: null });
    database.insertInto("users", { email: "amira@example.com" });

    expectStorageError(() => database.insertInto("users", { email: "amira@example.com" }), "UNIQUE_CONSTRAINT_VIOLATION");
    expect(database.getTable("users").rowCount()).toBe(3);
  });

  it("validates final update state atomically", () => {
    const database = new Database();
    database.createTable("users", [
      { name: "id", type: DataType.INTEGER, primaryKey: true },
      { name: "email", type: DataType.TEXT, unique: true }
    ]);
    database.insertInto("users", { id: 1, email: "a@example.com" });
    database.insertInto("users", { id: 2, email: "b@example.com" });

    expect(database.updateRows("users", (row) => row.id === 1, (row) => ({ ...row, email: "c@example.com" }))).toBe(1);
    expectStorageError(() => database.updateRows("users", () => true, (row) => ({ ...row, email: "same@example.com" })), "UNIQUE_CONSTRAINT_VIOLATION");
    expect(database.getTable("users").getRows().map((row) => row.email)).toEqual(["c@example.com", "b@example.com"]);
  });

  it("rejects multiple primary keys", () => {
    expectStorageError(
      () =>
        new Database().createTable("users", [
          { name: "id", type: DataType.INTEGER, primaryKey: true },
          { name: "tenant_id", type: DataType.INTEGER, primaryKey: true }
        ]),
      "MULTIPLE_PRIMARY_KEYS"
    );
  });
});

describe("foreign-key constraints", () => {
  it("validates foreign-key schema and preserves canonical metadata spelling", () => {
    const database = new Database();
    database.createTable("Departments", [{ name: "ID", type: DataType.INTEGER, primaryKey: true }]);
    const employees = database.createTable("employees", [
      { name: "department_id", type: DataType.INTEGER, references: { tableName: "departments", columnName: "id" } }
    ]);

    expect(employees.foreignKeys).toEqual([
      { columnName: "department_id", referencedTableName: "Departments", referencedColumnName: "ID" }
    ]);
  });

  it("rejects invalid foreign-key schemas", () => {
    expectStorageError(
      () => new Database().createTable("employees", [{ name: "department_id", type: DataType.INTEGER, references: { tableName: "departments", columnName: "id" } }]),
      "REFERENCED_TABLE_NOT_FOUND"
    );

    const missingColumn = new Database();
    missingColumn.createTable("departments", [{ name: "id", type: DataType.INTEGER, primaryKey: true }]);
    expectStorageError(
      () => missingColumn.createTable("employees", [{ name: "department_id", type: DataType.INTEGER, references: { tableName: "departments", columnName: "missing" } }]),
      "REFERENCED_COLUMN_NOT_FOUND"
    );

    const notUnique = new Database();
    notUnique.createTable("departments", [{ name: "id", type: DataType.INTEGER }]);
    expectStorageError(
      () => notUnique.createTable("employees", [{ name: "department_id", type: DataType.INTEGER, references: { tableName: "departments", columnName: "id" } }]),
      "REFERENCED_COLUMN_NOT_UNIQUE"
    );

    const typeMismatch = new Database();
    typeMismatch.createTable("departments", [{ name: "id", type: DataType.TEXT, unique: true }]);
    expectStorageError(
      () => typeMismatch.createTable("employees", [{ name: "department_id", type: DataType.INTEGER, references: { tableName: "departments", columnName: "id" } }]),
      "FOREIGN_KEY_TYPE_MISMATCH"
    );
  });

  it("enforces foreign keys on insert, update, and delete", () => {
    const database = createDepartmentDatabase();
    database.insertInto("departments", { id: 1, code: "ENG", active: true });
    database.insertInto("departments", { id: 2, code: "DES", active: null });
    database.insertInto("employees", { id: 1, name: "Amira", department_id: 1 });
    database.insertInto("employees", { id: 2, name: "Maya", department_id: null });

    expectStorageError(() => database.insertInto("employees", { id: 3, name: "Noah", department_id: 999 }), "FOREIGN_KEY_VIOLATION");
    expect(database.updateRows("employees", (row) => row.id === 2, (row) => ({ ...row, department_id: 2 }))).toBe(1);
    expectStorageError(() => database.updateRows("employees", (row) => row.id === 2, (row) => ({ ...row, department_id: 999 })), "FOREIGN_KEY_VIOLATION");
    expectStorageError(() => database.updateRows("departments", (row) => row.id === 1, (row) => ({ ...row, id: 10 })), "REFERENCED_ROW_EXISTS");
    expectStorageError(() => database.deleteRows("departments", (row) => row.id === 1), "REFERENCED_ROW_EXISTS");

    expect(database.deleteRows("employees", (row) => row.department_id === 1)).toBe(1);
    expect(database.deleteRows("departments", (row) => row.id === 1)).toBe(1);
  });

  it("attaches serialisable foreign-key error metadata", () => {
    const database = createDepartmentDatabase();
    const error = expectStorageError(
      () => database.insertInto("employees", { id: 1, name: "Amira", department_id: 999 }),
      "FOREIGN_KEY_VIOLATION"
    );

    expect(JSON.parse(JSON.stringify({ ...error }))).toMatchObject({
      code: "FOREIGN_KEY_VIOLATION",
      tableName: "employees",
      columnName: "department_id",
      value: 999,
      referencedTableName: "departments",
      referencedColumnName: "id"
    });
  });
});
