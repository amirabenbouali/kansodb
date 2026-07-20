import { describe, expect, it } from "vitest";
import { DataType, StorageError, Table, type ColumnDefinition, type InputRow } from "../../src/index.js";

const employeeColumns: ColumnDefinition[] = [
  { name: "id", type: DataType.INTEGER },
  { name: "name", type: DataType.TEXT },
  { name: "salary", type: DataType.DECIMAL, nullable: true },
  { name: "active", type: DataType.BOOLEAN }
];

function createEmployeesTable(): Table {
  return new Table("employees", employeeColumns);
}

function validEmployee(overrides: Partial<InputRow> = {}): InputRow {
  return {
    id: 1,
    name: "Amira",
    salary: 45000.5,
    active: true,
    ...overrides
  };
}

function expectStorageError(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error("Expected storage action to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(StorageError);
    expect(error).toMatchObject({ code });
  }
}

describe("Table schema", () => {
  it("creates a valid table", () => {
    const table = createEmployeesTable();

    expect(table.name).toBe("employees");
    expect(table.getSchema()).toEqual([
      { name: "id", type: DataType.INTEGER, nullable: false },
      { name: "name", type: DataType.TEXT, nullable: false },
      { name: "salary", type: DataType.DECIMAL, nullable: true },
      { name: "active", type: DataType.BOOLEAN, nullable: false }
    ]);
  });

  it("rejects an empty table name", () => {
    expectStorageError(() => new Table(" ", employeeColumns), "INVALID_TABLE_NAME");
  });

  it("rejects an empty column name", () => {
    expectStorageError(() => new Table("employees", [{ name: "", type: DataType.TEXT }]), "INVALID_COLUMN_NAME");
  });

  it("rejects duplicate column names", () => {
    expectStorageError(
      () =>
        new Table("employees", [
          { name: "id", type: DataType.INTEGER },
          { name: "id", type: DataType.TEXT }
        ]),
      "DUPLICATE_COLUMN"
    );
  });

  it("rejects case-insensitive duplicate column names", () => {
    expectStorageError(
      () =>
        new Table("employees", [
          { name: "id", type: DataType.INTEGER },
          { name: "ID", type: DataType.INTEGER }
        ]),
      "DUPLICATE_COLUMN"
    );
  });

  it("preserves schema spelling", () => {
    const table = new Table("employees", [{ name: "EmployeeName", type: DataType.TEXT }]);

    expect(table.getSchema()[0]?.name).toBe("EmployeeName");
  });

  it("does not expose internal schema objects", () => {
    const table = createEmployeesTable();
    const schema = table.getSchema();
    schema[0] = { name: "changed", type: DataType.TEXT, nullable: true };
    schema[1]!.name = "mutated";

    expect(table.getSchema()[0]).toEqual({ name: "id", type: DataType.INTEGER, nullable: false });
    expect(table.getSchema()[1]).toEqual({ name: "name", type: DataType.TEXT, nullable: false });
  });
});

describe("Row insertion", () => {
  it("inserts a valid row", () => {
    const table = createEmployeesTable();

    expect(table.insert(validEmployee())).toEqual({
      id: 1,
      name: "Amira",
      salary: 45000.5,
      active: true
    });
  });

  it("inserts multiple rows", () => {
    const table = createEmployeesTable();
    table.insert(validEmployee({ id: 1, name: "Amira" }));
    table.insert(validEmployee({ id: 2, name: "Maya" }));

    expect(table.getRows()).toHaveLength(2);
  });

  it("accepts integer values", () => {
    expect(createEmployeesTable().insert(validEmployee({ id: 42 })).id).toBe(42);
  });

  it("accepts decimal values", () => {
    expect(createEmployeesTable().insert(validEmployee({ salary: 42000.75 })).salary).toBe(42000.75);
  });

  it("accepts text values", () => {
    expect(createEmployeesTable().insert(validEmployee({ name: "Maya" })).name).toBe("Maya");
  });

  it("accepts boolean values", () => {
    expect(createEmployeesTable().insert(validEmployee({ active: false })).active).toBe(false);
  });

  it("accepts nullable values", () => {
    expect(createEmployeesTable().insert(validEmployee({ salary: null })).salary).toBeNull();
  });

  it("stores missing nullable columns as null", () => {
    const table = createEmployeesTable();
    const row = table.insert({ id: 1, name: "Amira", active: true });

    expect(row.salary).toBeNull();
  });

  it("matches input row column names case-insensitively", () => {
    const table = createEmployeesTable();

    expect(table.insert({ ID: 1, NAME: "Amira", SALARY: 45000, ACTIVE: true })).toEqual({
      id: 1,
      name: "Amira",
      salary: 45000,
      active: true
    });
  });

  it("rejects duplicate input values for the same column", () => {
    expectStorageError(
      () => createEmployeesTable().insert({ id: 1, ID: 2, name: "Amira", salary: 45000, active: true }),
      "DUPLICATE_COLUMN"
    );
  });

  it("rejects missing required columns", () => {
    expectStorageError(() => createEmployeesTable().insert({ name: "Amira", active: true }), "MISSING_COLUMN");
  });

  it("rejects unknown columns", () => {
    expectStorageError(() => createEmployeesTable().insert(validEmployee({ unknown: "value" })), "UNKNOWN_COLUMN");
  });

  it("rejects wrong value types", () => {
    expectStorageError(() => createEmployeesTable().insert(validEmployee({ name: 123 })), "TYPE_MISMATCH");
  });

  it("rejects decimals in INTEGER columns", () => {
    expectStorageError(() => createEmployeesTable().insert(validEmployee({ id: 1.5 })), "TYPE_MISMATCH");
  });

  it("accepts integers in DECIMAL columns", () => {
    expect(createEmployeesTable().insert(validEmployee({ salary: 45000 })).salary).toBe(45000);
  });

  it("rejects NaN", () => {
    expectStorageError(() => createEmployeesTable().insert(validEmployee({ salary: Number.NaN })), "INVALID_NUMBER");
  });

  it("rejects positive infinity", () => {
    expectStorageError(() => createEmployeesTable().insert(validEmployee({ salary: Number.POSITIVE_INFINITY })), "INVALID_NUMBER");
  });

  it("rejects negative infinity", () => {
    expectStorageError(() => createEmployeesTable().insert(validEmployee({ salary: Number.NEGATIVE_INFINITY })), "INVALID_NUMBER");
  });

  it("enforces null constraints", () => {
    expectStorageError(() => createEmployeesTable().insert(validEmployee({ name: null })), "NULL_CONSTRAINT");
  });

  it("does not coerce strings to numbers", () => {
    expectStorageError(() => createEmployeesTable().insert(validEmployee({ id: "1" })), "TYPE_MISMATCH");
  });

  it("does not coerce numbers to booleans", () => {
    expectStorageError(() => createEmployeesTable().insert(validEmployee({ active: 1 })), "TYPE_MISMATCH");
  });
});

describe("Table operations", () => {
  it("returns the row count", () => {
    const table = createEmployeesTable();
    table.insert(validEmployee({ id: 1 }));
    table.insert(validEmployee({ id: 2 }));

    expect(table.rowCount()).toBe(2);
  });

  it("retrieves rows", () => {
    const table = createEmployeesTable();
    table.insert(validEmployee());

    expect(table.getRows()).toEqual([
      {
        id: 1,
        name: "Amira",
        salary: 45000.5,
        active: true
      }
    ]);
  });

  it("clears rows", () => {
    const table = createEmployeesTable();
    table.insert(validEmployee());
    table.clear();

    expect(table.rowCount()).toBe(0);
    expect(table.getRows()).toEqual([]);
  });

  it("looks up columns case-insensitively", () => {
    const table = createEmployeesTable();

    expect(table.hasColumn("SALARY")).toBe(true);
    expect(table.getColumn("SALARY")).toEqual({ name: "salary", type: DataType.DECIMAL, nullable: true });
  });

  it("rejects unknown column lookup", () => {
    expectStorageError(() => createEmployeesTable().getColumn("department"), "UNKNOWN_COLUMN");
  });

  it("does not let returned row mutation affect stored data", () => {
    const table = createEmployeesTable();
    table.insert(validEmployee());
    const rows = table.getRows();

    rows[0]!.name = "Changed";
    rows.push({ id: 2, name: "Injected", salary: 1, active: false });

    expect(table.getRows()).toEqual([
      {
        id: 1,
        name: "Amira",
        salary: 45000.5,
        active: true
      }
    ]);
  });
});
