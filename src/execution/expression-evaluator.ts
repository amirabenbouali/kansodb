import { ExecutionError } from "../errors/execution-error.js";
import type { ArithmeticOperator, ComparisonOperator, Expression, UnaryOperator } from "../parser/ast.js";
import type { DatabaseValue, StoredRow } from "../storage/row.js";
import type { Table } from "../storage/table.js";
import type { JoinedRow, QueryScope } from "./query-scope.js";
import { passesPredicate, sqlAnd, sqlOr, truthValueFromBoolean, type TruthValue } from "./truth-value.js";

export interface ScalarContext {
  resolveColumn(name: string): { name: string };
  getValue(columnName: string): DatabaseValue;
  tableName?: string;
}

export interface ScopedScalarContext {
  scope: QueryScope;
  row: JoinedRow;
}

export function evaluateExpression(expression: Expression, row: Readonly<StoredRow>, table: Table): boolean {
  return passesPredicate(evaluatePredicate(expression, tableContext(row, table)));
}

export function evaluateScalar(expression: Expression, context: ScalarContext): DatabaseValue {
  switch (expression.type) {
    case "literal":
      return expression.value;
    case "column": {
      if (expression.qualifier !== undefined && expression.qualifier.toLowerCase() !== context.tableName?.toLowerCase()) {
        throw new ExecutionError({
          code: "RELATION_NOT_FOUND",
          message: `Relation "${expression.qualifier}" does not exist in this query.`,
          columnName: expression.name
        });
      }
      const column = context.resolveColumn(expression.name);
      return context.getValue(column.name);
    }
    case "unary":
      return evaluateUnary(expression.operator, evaluateScalar(expression.operand, context));
    case "arithmetic":
      return evaluateArithmetic(
        expression.operator,
        evaluateScalar(expression.left, context),
        evaluateScalar(expression.right, context)
      );
    case "comparison":
      return scalarFromPredicate(evaluateComparison(
        expression.operator,
        evaluateScalar(expression.left, context),
        evaluateScalar(expression.right, context)
      ));
    case "logical":
      return scalarFromPredicate(evaluatePredicate(expression, context));
    case "null_check":
      return scalarFromPredicate(evaluatePredicate(expression, context));
    case "aggregate":
      throw new ExecutionError({
        code: "INVALID_AGGREGATE_PLACEMENT",
        message: "Aggregate functions are not allowed in row-level expressions."
      });
  }
}

export function evaluateBoolean(expression: Expression, context: ScalarContext): boolean {
  return passesPredicate(evaluatePredicate(expression, context));
}

export function evaluatePredicate(expression: Expression, context: ScalarContext): TruthValue {
  switch (expression.type) {
    case "comparison":
      return evaluateComparison(expression.operator, evaluateScalar(expression.left, context), evaluateScalar(expression.right, context));
    case "logical":
      return evaluateLogicalPredicate(expression.operator, () => evaluatePredicate(expression.left, context), () => evaluatePredicate(expression.right, context));
    case "null_check": {
      const isNull = evaluateScalar(expression.operand, context) === null;
      return truthValueFromBoolean(expression.negated ? !isNull : isNull);
    }
    case "literal":
      if (typeof expression.value === "boolean") return truthValueFromBoolean(expression.value);
      if (expression.value === null) return "UNKNOWN";
      throw new ExecutionError({ code: "INVALID_PREDICATE", message: "Predicate expression must evaluate to a truth value." });
    case "column":
    case "unary":
    case "arithmetic":
    case "aggregate": {
      const value = evaluateScalar(expression, context);
      if (typeof value === "boolean") return truthValueFromBoolean(value);
      if (value === null) return "UNKNOWN";
      throw new ExecutionError({ code: "INVALID_PREDICATE", message: "Predicate expression must evaluate to a truth value." });
    }
  }
}

export function evaluateScopedScalar(expression: Expression, context: ScopedScalarContext): DatabaseValue {
  switch (expression.type) {
    case "literal":
      return expression.value;
    case "column":
      return context.scope.value(context.row, context.scope.resolveColumn(expression));
    case "unary":
      return evaluateUnary(expression.operator, evaluateScopedScalar(expression.operand, context));
    case "arithmetic":
      return evaluateArithmetic(
        expression.operator,
        evaluateScopedScalar(expression.left, context),
        evaluateScopedScalar(expression.right, context)
      );
    case "comparison":
      return scalarFromPredicate(evaluateComparison(
        expression.operator,
        evaluateScopedScalar(expression.left, context),
        evaluateScopedScalar(expression.right, context)
      ));
    case "logical":
      return scalarFromPredicate(evaluateScopedPredicate(expression, context));
    case "null_check":
      return scalarFromPredicate(evaluateScopedPredicate(expression, context));
    case "aggregate":
      throw new ExecutionError({
        code: "INVALID_AGGREGATE_PLACEMENT",
        message: "Aggregate functions are not allowed in row-level expressions."
      });
  }
}

export function evaluateScopedBoolean(expression: Expression, context: ScopedScalarContext): boolean {
  return passesPredicate(evaluateScopedPredicate(expression, context));
}

export function evaluateScopedPredicate(expression: Expression, context: ScopedScalarContext): TruthValue {
  switch (expression.type) {
    case "comparison":
      return evaluateComparison(expression.operator, evaluateScopedScalar(expression.left, context), evaluateScopedScalar(expression.right, context));
    case "logical":
      return evaluateLogicalPredicate(expression.operator, () => evaluateScopedPredicate(expression.left, context), () => evaluateScopedPredicate(expression.right, context));
    case "null_check": {
      const isNull = evaluateScopedScalar(expression.operand, context) === null;
      return truthValueFromBoolean(expression.negated ? !isNull : isNull);
    }
    case "literal":
      if (typeof expression.value === "boolean") return truthValueFromBoolean(expression.value);
      if (expression.value === null) return "UNKNOWN";
      throw new ExecutionError({ code: "INVALID_PREDICATE", message: "Predicate expression must evaluate to a truth value." });
    case "column":
    case "unary":
    case "arithmetic":
    case "aggregate": {
      const value = evaluateScopedScalar(expression, context);
      if (typeof value === "boolean") return truthValueFromBoolean(value);
      if (value === null) return "UNKNOWN";
      throw new ExecutionError({ code: "INVALID_PREDICATE", message: "Predicate expression must evaluate to a truth value." });
    }
  }
}

export function compareDatabaseValues(left: DatabaseValue, right: DatabaseValue): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  if (typeof left === "number" && typeof right === "number") return left - right;
  if (typeof left === "string" && typeof right === "string") return left.localeCompare(right);
  if (typeof left === "boolean" && typeof right === "boolean") return Number(left) - Number(right);
  throw new ExecutionError({ code: "TYPE_MISMATCH", message: `Cannot compare ${typeof left} with ${typeof right}.` });
}

export function tableContext(row: Readonly<StoredRow>, table: Table): ScalarContext {
  return {
    tableName: table.name,
    resolveColumn(name) {
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
    },
    getValue(columnName) {
      return row[columnName] ?? null;
    }
  };
}

function evaluateUnary(operator: UnaryOperator, value: DatabaseValue): DatabaseValue {
  if (value === null) return null;
  assertNumber(value, `Operator "${operator}" requires a numeric operand.`);
  const result = operator === "+" ? value : -value;
  return finite(result);
}

function evaluateArithmetic(operator: ArithmeticOperator, left: DatabaseValue, right: DatabaseValue): DatabaseValue {
  if (left === null || right === null) return null;
  assertNumber(left, `Operator "${operator}" requires numeric operands.`);
  assertNumber(right, `Operator "${operator}" requires numeric operands.`);

  if (operator === "/" && right === 0) {
    throw new ExecutionError({ code: "DIVISION_BY_ZERO", message: "Division by zero is not allowed." });
  }

  if (operator === "%" && right === 0) {
    throw new ExecutionError({ code: "MODULO_BY_ZERO", message: "Modulo by zero is not allowed." });
  }

  switch (operator) {
    case "+":
      return finite(left + right);
    case "-":
      return finite(left - right);
    case "*":
      return finite(left * right);
    case "/":
      return finite(left / right);
    case "%":
      return finite(left % right);
  }
}

function evaluateComparison(operator: ComparisonOperator, left: DatabaseValue, right: DatabaseValue): TruthValue {
  if (left === null || right === null) {
    return "UNKNOWN";
  }

  switch (operator) {
    case "=":
      return truthValueFromBoolean(left === right);
    case "!=":
      return truthValueFromBoolean(left !== right);
    case ">":
    case ">=":
    case "<":
    case "<=":
      if (typeof left === "boolean" || typeof right === "boolean") {
        throw new ExecutionError({ code: "INVALID_COMPARISON", message: `Invalid comparison for operator "${operator}".`, operator });
      }
      if (typeof left !== typeof right) {
        throw new ExecutionError({ code: "TYPE_MISMATCH", message: `Operator "${operator}" cannot compare ${typeof left} with ${typeof right}.`, operator });
      }
      return truthValueFromBoolean(compareOrdered(operator, left, right));
  }
}

function scalarFromPredicate(value: TruthValue): boolean | null {
  if (value === "TRUE") return true;
  if (value === "FALSE") return false;
  return null;
}

function evaluateLogicalPredicate(operator: "AND" | "OR", leftThunk: () => TruthValue, rightThunk: () => TruthValue): TruthValue {
  const left = leftThunk();
  if (operator === "AND" && left === "FALSE") return "FALSE";
  if (operator === "OR" && left === "TRUE") return "TRUE";
  return operator === "AND" ? sqlAnd(left, rightThunk()) : sqlOr(left, rightThunk());
}

function compareOrdered(operator: ">" | ">=" | "<" | "<=", left: number | string, right: number | string): boolean {
  switch (operator) {
    case ">":
      return left > right;
    case ">=":
      return left >= right;
    case "<":
      return left < right;
    case "<=":
      return left <= right;
  }
}

function assertNumber(value: Exclude<DatabaseValue, null>, message: string): asserts value is number {
  if (typeof value !== "number") {
    throw new ExecutionError({ code: "INVALID_OPERAND_TYPE", message });
  }
}

function finite(value: number): number {
  if (!Number.isFinite(value) || Number.isNaN(value)) {
    throw new ExecutionError({ code: "NON_FINITE_RESULT", message: "Arithmetic produced a non-finite result." });
  }
  return value;
}
