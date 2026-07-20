import { describe, expect, it } from "vitest";
import {
  DataType,
  ExecutionError,
  Table,
  evaluateExpression,
  type Expression,
  type StoredRow
} from "../../src/index.js";

function createTable(): Table {
  return new Table("employees", [
    { name: "id", type: DataType.INTEGER },
    { name: "name", type: DataType.TEXT },
    { name: "salary", type: DataType.DECIMAL, nullable: true },
    { name: "active", type: DataType.BOOLEAN }
  ]);
}

function row(overrides: Partial<StoredRow> = {}): StoredRow {
  return {
    id: 1,
    name: "Amira",
    salary: 48000,
    active: true,
    ...overrides
  };
}

function comparison(column: string, operator: "=" | "!=" | ">" | ">=" | "<" | "<=", value: string | number | boolean | null): Expression {
  return {
    type: "comparison",
    operator,
    left: { type: "column", name: column },
    right: { type: "literal", value }
  };
}

function expectExecutionError(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error("Expected execution action to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(ExecutionError);
    expect(error).toMatchObject({ code });
  }
}

describe("evaluateExpression", () => {
  it("evaluates numeric equality", () => {
    expect(evaluateExpression(comparison("salary", "=", 48000), row(), createTable())).toBe(true);
  });

  it("evaluates numeric inequality", () => {
    expect(evaluateExpression(comparison("salary", "!=", 42000), row(), createTable())).toBe(true);
  });

  it("evaluates greater than", () => {
    expect(evaluateExpression(comparison("salary", ">", 45000), row(), createTable())).toBe(true);
  });

  it("evaluates greater than or equal", () => {
    expect(evaluateExpression(comparison("salary", ">=", 48000), row(), createTable())).toBe(true);
  });

  it("evaluates less than", () => {
    expect(evaluateExpression(comparison("salary", "<", 50000), row(), createTable())).toBe(true);
  });

  it("evaluates less than or equal", () => {
    expect(evaluateExpression(comparison("salary", "<=", 48000), row(), createTable())).toBe(true);
  });

  it("evaluates string equality", () => {
    expect(evaluateExpression(comparison("name", "=", "Amira"), row(), createTable())).toBe(true);
  });

  it("evaluates string inequality", () => {
    expect(evaluateExpression(comparison("name", "!=", "Maya"), row(), createTable())).toBe(true);
  });

  it("evaluates string lexicographical comparison", () => {
    expect(evaluateExpression(comparison("name", "<", "Noah"), row(), createTable())).toBe(true);
  });

  it("evaluates boolean equality", () => {
    expect(evaluateExpression(comparison("active", "=", true), row(), createTable())).toBe(true);
  });

  it("evaluates null equality", () => {
    expect(evaluateExpression(comparison("salary", "=", null), row({ salary: null }), createTable())).toBe(true);
  });

  it("evaluates null inequality", () => {
    expect(evaluateExpression(comparison("salary", "!=", null), row({ salary: 48000 }), createTable())).toBe(true);
    expect(evaluateExpression(comparison("salary", "!=", null), row({ salary: null }), createTable())).toBe(false);
  });

  it("does not coerce numbers and strings", () => {
    expect(evaluateExpression(comparison("salary", "=", "48000"), row(), createTable())).toBe(false);
  });

  it("rejects different-type ordering comparisons", () => {
    expectExecutionError(() => evaluateExpression(comparison("salary", ">", "45000"), row(), createTable()), "TYPE_MISMATCH");
  });

  it("rejects boolean ordering comparisons", () => {
    expectExecutionError(() => evaluateExpression(comparison("active", ">", false), row(), createTable()), "INVALID_COMPARISON");
  });

  it("rejects null ordering comparisons", () => {
    expectExecutionError(() => evaluateExpression(comparison("salary", ">", null), row(), createTable()), "INVALID_COMPARISON");
  });

  it("evaluates AND expressions", () => {
    expect(
      evaluateExpression(
        {
          type: "logical",
          operator: "AND",
          left: comparison("salary", ">", 45000),
          right: comparison("active", "=", true)
        },
        row(),
        createTable()
      )
    ).toBe(true);
  });

  it("evaluates OR expressions", () => {
    expect(
      evaluateExpression(
        {
          type: "logical",
          operator: "OR",
          left: comparison("salary", "<", 1000),
          right: comparison("active", "=", true)
        },
        row(),
        createTable()
      )
    ).toBe(true);
  });

  it("short-circuits AND", () => {
    expect(
      evaluateExpression(
        {
          type: "logical",
          operator: "AND",
          left: comparison("salary", "<", 1000),
          right: comparison("missing", "=", true)
        },
        row(),
        createTable()
      )
    ).toBe(false);
  });

  it("short-circuits OR", () => {
    expect(
      evaluateExpression(
        {
          type: "logical",
          operator: "OR",
          left: comparison("salary", ">", 1000),
          right: comparison("missing", "=", true)
        },
        row(),
        createTable()
      )
    ).toBe(true);
  });
});
