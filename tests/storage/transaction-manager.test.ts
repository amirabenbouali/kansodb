import { describe, expect, it } from "vitest";
import { Database, DataType, TransactionError } from "../../src/index.js";

function createAccountsDatabase(): Database {
  const database = new Database();
  database.createTable("accounts", [
    { name: "id", type: DataType.INTEGER, primaryKey: true },
    { name: "owner", type: DataType.TEXT, unique: true },
    { name: "balance", type: DataType.DECIMAL }
  ]);
  database.insertInto("accounts", { id: 1, owner: "Amira", balance: 1000 });
  database.insertInto("accounts", { id: 2, owner: "Maya", balance: 500 });
  return database;
}

function expectTransactionError(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error("Expected transaction action to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(TransactionError);
    expect(error).toMatchObject({ code });
  }
}

describe("database snapshots", () => {
  it("snapshots empty and multi-table databases with immutable deep copies", () => {
    const empty = new Database().createSnapshot();
    expect(empty).toEqual({ tables: [] });
    expect(Object.isFrozen(empty.tables)).toBe(true);

    const database = createAccountsDatabase();
    database.createTable("departments", [{ name: "id", type: DataType.INTEGER, primaryKey: true }]);
    const snapshot = database.createSnapshot();

    expect(snapshot.tables.map((table) => table.name)).toEqual(["accounts", "departments"]);
    expect(snapshot.tables[0]?.primaryKey).toEqual({ columnName: "id" });
    expect(snapshot.tables[0]?.uniqueConstraints).toEqual([{ columnName: "id" }, { columnName: "owner" }]);
    expect(snapshot.tables[0]?.rows).toEqual([
      { id: 1, owner: "Amira", balance: 1000 },
      { id: 2, owner: "Maya", balance: 500 }
    ]);
    expect(Object.isFrozen(snapshot.tables[0]?.rows[0])).toBe(true);

    database.updateRows("accounts", (row) => row.id === 1, (row) => ({ ...row, balance: 900 }));
    expect(snapshot.tables[0]?.rows[0]).toEqual({ id: 1, owner: "Amira", balance: 1000 });
  });

  it("restores inserted, updated, deleted, and created table state", () => {
    const database = createAccountsDatabase();
    const snapshot = database.createSnapshot();

    database.updateRows("accounts", (row) => row.id === 1, (row) => ({ ...row, balance: 900 }));
    database.deleteRows("accounts", (row) => row.id === 2);
    database.insertInto("accounts", { id: 3, owner: "Sara", balance: 800 });
    database.createTable("audit_log", [{ name: "id", type: DataType.INTEGER, primaryKey: true }]);

    database.restoreSnapshot(snapshot);

    expect(database.listTables()).toEqual(["accounts"]);
    expect(database.getTable("accounts").getRows()).toEqual([
      { id: 1, owner: "Amira", balance: 1000 },
      { id: 2, owner: "Maya", balance: 500 }
    ]);
    expect(database.getTable("accounts").getSchema()).toMatchObject([
      { name: "id", primaryKey: true, unique: true, nullable: false },
      { name: "owner", unique: true },
      { name: "balance", type: DataType.DECIMAL }
    ]);
  });

  it("restores related table foreign-key metadata", () => {
    const database = new Database();
    database.createTable("departments", [{ name: "ID", type: DataType.INTEGER, primaryKey: true }]);
    database.createTable("employees", [
      { name: "department_id", type: DataType.INTEGER, nullable: true, references: { tableName: "departments", columnName: "id" } }
    ]);
    const snapshot = database.createSnapshot();
    database.insertInto("departments", { ID: 1 });
    database.restoreSnapshot(snapshot);

    expect(database.getTable("employees").foreignKeys).toEqual([
      { columnName: "department_id", referencedTableName: "departments", referencedColumnName: "ID" }
    ]);
  });
});

describe("TransactionManager", () => {
  it("begins, commits, and rolls back transactions", () => {
    const database = createAccountsDatabase();

    expect(database.transactionState).toBe("IDLE");
    database.transactionManager.begin();
    expect(database.transactionState).toBe("ACTIVE");
    database.insertInto("accounts", { id: 3, owner: "Sara", balance: 800 });
    database.transactionManager.commit();

    expect(database.transactionState).toBe("IDLE");
    expect(database.getTable("accounts").rowCount()).toBe(3);

    database.transactionManager.begin();
    database.deleteRows("accounts", (row) => row.id === 3);
    database.transactionManager.rollback();

    expect(database.transactionState).toBe("IDLE");
    expect(database.getTable("accounts").rowCount()).toBe(3);
  });

  it("rejects nested begin, commit without begin, and rollback without begin", () => {
    const database = createAccountsDatabase();

    expectTransactionError(() => database.transactionManager.commit(), "NO_ACTIVE_TRANSACTION");
    expectTransactionError(() => database.transactionManager.rollback(), "NO_ACTIVE_TRANSACTION");

    database.transactionManager.begin();
    expectTransactionError(() => database.transactionManager.begin(), "TRANSACTION_ALREADY_ACTIVE");
    expect(database.transactionState).toBe("ACTIVE");
  });

  it("keeps transaction state per database instance", () => {
    const first = createAccountsDatabase();
    const second = createAccountsDatabase();

    first.transactionManager.begin();

    expect(first.transactionState).toBe("ACTIVE");
    expect(second.transactionState).toBe("IDLE");
  });

  it("rolls back and commits table creation", () => {
    const rollbackDatabase = createAccountsDatabase();
    rollbackDatabase.transactionManager.begin();
    rollbackDatabase.createTable("audit_log", [{ name: "id", type: DataType.INTEGER, primaryKey: true }]);
    rollbackDatabase.transactionManager.rollback();
    expect(rollbackDatabase.hasTable("audit_log")).toBe(false);

    const commitDatabase = createAccountsDatabase();
    commitDatabase.transactionManager.begin();
    commitDatabase.createTable("audit_log", [{ name: "id", type: DataType.INTEGER, primaryKey: true }]);
    commitDatabase.transactionManager.commit();
    expect(commitDatabase.hasTable("audit_log")).toBe(true);
  });
});
