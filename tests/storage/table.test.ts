import { describe, expect, it } from "vitest";
import { DataType, StorageError, Table, type ColumnDefinition, type DatabaseValue, type InputRow } from "../../src/index.js";

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
      { name: "id", type: DataType.INTEGER, nullable: false, unique: false, primaryKey: false },
      { name: "name", type: DataType.TEXT, nullable: false, unique: false, primaryKey: false },
      { name: "salary", type: DataType.DECIMAL, nullable: true, unique: false, primaryKey: false },
      { name: "active", type: DataType.BOOLEAN, nullable: false, unique: false, primaryKey: false }
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
    schema[0] = { name: "changed", type: DataType.TEXT, nullable: true, unique: false, primaryKey: false };
    schema[1]!.name = "mutated";

    expect(table.getSchema()[0]).toEqual({ name: "id", type: DataType.INTEGER, nullable: false, unique: false, primaryKey: false });
    expect(table.getSchema()[1]).toEqual({ name: "name", type: DataType.TEXT, nullable: false, unique: false, primaryKey: false });
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
    expectStorageError(() => createEmployeesTable().insert(validEmployee({ name: null })), "NOT_NULL_VIOLATION");
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
    expect(table.getColumn("SALARY")).toEqual({ name: "salary", type: DataType.DECIMAL, nullable: true, unique: false, primaryKey: false });
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

describe("Row updates", () => {
  it("updates one matching row", () => {
    const table = createEmployeesTable();
    table.insert(validEmployee({ id: 1, name: "Amira" }));
    table.insert(validEmployee({ id: 2, name: "Maya" }));

    expect(table.updateRows((row) => row.id === 1, (row) => ({ ...row, salary: 50000 }))).toBe(1);
    expect(table.getRows()[0]?.salary).toBe(50000);
  });

  it("updates multiple matching rows", () => {
    const table = createEmployeesTable();
    table.insert(validEmployee({ id: 1, active: true }));
    table.insert(validEmployee({ id: 2, active: true }));

    expect(table.updateRows((row) => row.active === true, (row) => ({ ...row, active: false }))).toBe(2);
  });

  it("updates every row and zero rows", () => {
    const table = createEmployeesTable();
    table.insert(validEmployee({ id: 1 }));
    table.insert(validEmployee({ id: 2 }));

    expect(table.updateRows(() => true, (row) => ({ ...row, salary: 1 }))).toBe(2);
    expect(table.updateRows(() => false, (row) => ({ ...row, salary: 2 }))).toBe(0);
    expect(table.getRows().map((row) => row.salary)).toEqual([1, 1]);
  });

  it("preserves unaffected rows and row order", () => {
    const table = createEmployeesTable();
    table.insert(validEmployee({ id: 1, name: "Amira" }));
    table.insert(validEmployee({ id: 2, name: "Maya" }));
    table.insert(validEmployee({ id: 3, name: "Noah" }));

    table.updateRows((row) => row.id === 2, (row) => ({ ...row, name: "Maya B" }));

    expect(table.getRows().map((row) => row.name)).toEqual(["Amira", "Maya B", "Noah"]);
  });

  it("validates updated row types and nullability", () => {
    const table = createEmployeesTable();
    table.insert(validEmployee());

    expectStorageError(() => table.updateRows(() => true, (row) => ({ ...row, name: 123 })), "TYPE_MISMATCH");
    expectStorageError(() => table.updateRows(() => true, (row) => ({ ...row, name: null })), "NOT_NULL_VIOLATION");
  });

  it("rejects invalid numeric updates", () => {
    const table = createEmployeesTable();
    table.insert(validEmployee());

    expectStorageError(() => table.updateRows(() => true, (row) => ({ ...row, id: 1.5 })), "TYPE_MISMATCH");
    expectStorageError(() => table.updateRows(() => true, (row) => ({ ...row, salary: "10" })), "TYPE_MISMATCH");
    expectStorageError(() => table.updateRows(() => true, (row) => ({ ...row, active: 1 })), "TYPE_MISMATCH");
    expectStorageError(() => table.updateRows(() => true, (row) => ({ ...row, salary: Number.NaN })), "INVALID_NUMBER");
    expectStorageError(() => table.updateRows(() => true, (row) => ({ ...row, salary: Number.POSITIVE_INFINITY })), "INVALID_NUMBER");
  });

  it("does not mutate when validation fails", () => {
    const table = createEmployeesTable();
    table.insert(validEmployee({ id: 1, salary: 10 }));
    const before = table.getRows();

    expectStorageError(() => table.updateRows(() => true, (row) => ({ ...row, id: 1.5 })), "TYPE_MISMATCH");
    expect(table.getRows()).toEqual(before);
  });

  it("is atomic across multiple matching rows", () => {
    const table = createEmployeesTable();
    table.insert(validEmployee({ id: 1, salary: 10 }));
    table.insert(validEmployee({ id: 2, salary: 20 }));
    const before = table.getRows();

    expectStorageError(
      () => table.updateRows(() => true, (row) => ({ ...row, id: row.id === 2 ? 2.5 : row.id, salary: 99 })),
      "TYPE_MISMATCH"
    );
    expect(table.getRows()).toEqual(before);
  });

  it("does not expose internal rows to predicates or updaters", () => {
    const table = createEmployeesTable();
    table.insert(validEmployee({ id: 1, name: "Amira" }));

    table.updateRows(
      (row) => {
        (row as Record<string, DatabaseValue>).name = "Changed";
        return true;
      },
      (row) => {
        (row as Record<string, DatabaseValue>).salary = 1;
        return { ...row, active: false };
      }
    );

    expect(table.getRows()).toEqual([{ id: 1, name: "Amira", salary: 1, active: false }]);
  });
});

describe("Row deletion", () => {
  it("deletes one row, multiple rows, every row, and zero rows", () => {
    const table = createEmployeesTable();
    table.insert(validEmployee({ id: 1, active: true }));
    table.insert(validEmployee({ id: 2, active: false }));
    table.insert(validEmployee({ id: 3, active: false }));

    expect(table.deleteRows((row) => row.id === 1)).toBe(1);
    expect(table.deleteRows((row) => row.active === false)).toBe(2);
    expect(table.deleteRows(() => false)).toBe(0);
    expect(table.deleteRows(() => true)).toBe(0);
  });

  it("preserves remaining row order and returns affected row count", () => {
    const table = createEmployeesTable();
    table.insert(validEmployee({ id: 1, name: "Amira" }));
    table.insert(validEmployee({ id: 2, name: "Maya" }));
    table.insert(validEmployee({ id: 3, name: "Noah" }));

    expect(table.deleteRows((row) => row.id === 2)).toBe(1);
    expect(table.getRows().map((row) => row.name)).toEqual(["Amira", "Noah"]);
  });

  it("does not expose internal rows to delete predicates", () => {
    const table = createEmployeesTable();
    table.insert(validEmployee({ id: 1, name: "Amira" }));

    table.deleteRows((row) => {
      (row as Record<string, DatabaseValue>).name = "Changed";
      return false;
    });

    expect(table.getRows()[0]?.name).toBe("Amira");
  });
});
