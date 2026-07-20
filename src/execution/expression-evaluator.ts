import { ExecutionError } from "../errors/execution-error.js";
import type { ComparisonExpression, ComparisonOperator, Expression } from "../parser/ast.js";
import type { DatabaseValue, StoredRow } from "../storage/row.js";
import type { Table } from "../storage/table.js";

export function evaluateExpression(expression: Expression, row: Readonly<StoredRow>, table: Table): boolean {
  switch (expression.type) {
    case "comparison":
      return evaluateComparison(expression, row, table);
    case "logical":
      if (expression.operator === "AND") {
        return evaluateExpression(expression.left, row, table) && evaluateExpression(expression.right, row, table);
      }

      return evaluateExpression(expression.left, row, table) || evaluateExpression(expression.right, row, table);
  }
}

function evaluateComparison(expression: ComparisonExpression, row: Readonly<StoredRow>, table: Table): boolean {
  const column = resolveColumn(expression.left.name, table);
  const left = row[column.name];
  const right = expression.right.value;

  if (left === undefined) {
    throw new ExecutionError({
      code: "COLUMN_NOT_FOUND",
      message: `Column "${expression.left.name}" was not found in row`,
      tableName: table.name,
      columnName: expression.left.name
    });
  }

  switch (expression.operator) {
    case "=":
      return left === right;
    case "!=":
      return left !== right;
    case ">":
    case ">=":
    case "<":
    case "<=":
      return evaluateOrderingComparison(expression.operator, left, right, table.name, column.name);
  }
}

function resolveColumn(name: string, table: Table): { name: string } {
  try {
    return table.getColumn(name);
  } catch {
    throw new ExecutionError({
      code: "COLUMN_NOT_FOUND",
      message: `Column "${name}" was not found in table "${table.name}"`,
      tableName: table.name,
      columnName: name
    });
  }
}

function evaluateOrderingComparison(
  operator: ComparisonOperator,
  left: DatabaseValue,
  right: DatabaseValue,
  tableName: string,
  columnName: string
): boolean {
  if (left === null && right !== null) {
    return false;
  }

  validateOrderingOperands(operator, left, right, tableName, columnName);
  const comparableRight = right as number | string;

  switch (operator) {
    case ">":
      return left > comparableRight;
    case ">=":
      return left >= comparableRight;
    case "<":
      return left < comparableRight;
    case "<=":
      return left <= comparableRight;
    case "=":
    case "!=":
      throw new ExecutionError({
        code: "INVALID_COMPARISON",
        message: `Operator "${operator}" is not an ordering operator`,
        tableName,
        columnName,
        operator
      });
  }
}

function validateOrderingOperands(
  operator: ComparisonOperator,
  left: DatabaseValue,
  right: DatabaseValue,
  tableName: string,
  columnName: string
): asserts left is number | string {
  if (left === null || right === null) {
    throw new ExecutionError({
      code: "INVALID_COMPARISON",
      message: `Operator "${operator}" cannot compare null values`,
      tableName,
      columnName,
      operator,
      value: left === null ? left : right
    });
  }

  if (typeof left === "boolean" || typeof right === "boolean") {
    throw new ExecutionError({
      code: "INVALID_COMPARISON",
      message: `Operator "${operator}" cannot order boolean values`,
      tableName,
      columnName,
      operator,
      value: typeof left === "boolean" ? left : right
    });
  }

  if (typeof left !== typeof right) {
    throw new ExecutionError({
      code: "TYPE_MISMATCH",
      message: `Operator "${operator}" cannot compare ${typeof left} with ${typeof right}`,
      tableName,
      columnName,
      operator,
      value: right
    });
  }
}
