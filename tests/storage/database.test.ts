import { describe, expect, it } from "vitest";
import { Database, DataType, StorageError, type ColumnDefinition } from "../../src/index.js";

const employeeColumns: ColumnDefinition[] = [
  { name: "id", type: DataType.INTEGER },
  { name: "name", type: DataType.TEXT }
];

function expectStorageError(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error("Expected storage action to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(StorageError);
    expect(error).toMatchObject({ code });
  }
}

describe("Database operations", () => {
  it("creates a table", () => {
    const database = new Database();
    const table = database.createTable("employees", employeeColumns);

    expect(table.name).toBe("employees");
  });

  it("retrieves a table", () => {
    const database = new Database();
    const created = database.createTable("employees", employeeColumns);

    expect(database.getTable("employees")).toBe(created);
  });

  it("looks up tables case-insensitively", () => {
    const database = new Database();
    const created = database.createTable("employees", employeeColumns);

    expect(database.getTable("EMPLOYEES")).toBe(created);
  });

  it("checks whether a table exists", () => {
    const database = new Database();
    database.createTable("employees", employeeColumns);

    expect(database.hasTable("Employees")).toBe(true);
    expect(database.hasTable("departments")).toBe(false);
  });

  it("lists tables in creation order", () => {
    const database = new Database();
    database.createTable("employees", employeeColumns);
    database.createTable("departments", [{ name: "id", type: DataType.INTEGER }]);

    expect(database.listTables()).toEqual(["employees", "departments"]);
  });

  it("rejects duplicate table creation", () => {
    const database = new Database();
    database.createTable("employees", employeeColumns);

    expectStorageError(() => database.createTable("employees", employeeColumns), "TABLE_ALREADY_EXISTS");
  });

  it("rejects case-insensitive duplicate table creation", () => {
    const database = new Database();
    database.createTable("employees", employeeColumns);

    expectStorageError(() => database.createTable("EMPLOYEES", employeeColumns), "TABLE_ALREADY_EXISTS");
  });

  it("rejects unknown table lookup", () => {
    expectStorageError(() => new Database().getTable("employees"), "TABLE_NOT_FOUND");
  });

  it("drops a table", () => {
    const database = new Database();
    database.createTable("employees", employeeColumns);
    database.dropTable("EMPLOYEES");

    expect(database.hasTable("employees")).toBe(false);
  });

  it("rejects dropping an unknown table", () => {
    expectStorageError(() => new Database().dropTable("employees"), "TABLE_NOT_FOUND");
  });

  it("creates another table after dropping one", () => {
    const database = new Database();
    database.createTable("employees", employeeColumns);
    database.dropTable("employees");
    const replacement = database.createTable("EMPLOYEES", employeeColumns);

    expect(replacement.name).toBe("EMPLOYEES");
    expect(database.listTables()).toEqual(["EMPLOYEES"]);
  });

  it("rejects an empty table name", () => {
    expectStorageError(() => new Database().createTable("", employeeColumns), "INVALID_TABLE_NAME");
  });

  it("does not expose internal table collections through listTables", () => {
    const database = new Database();
    database.createTable("employees", employeeColumns);
    const names = database.listTables();
    names.push("departments");

    expect(database.listTables()).toEqual(["employees"]);
  });
});
