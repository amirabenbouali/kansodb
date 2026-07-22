import type { AggregateExpression, Expression, SelectableExpression } from "../parser/ast.js";

export function formatExpression(expression: Expression | SelectableExpression): string {
  return format(expression, 0);
}

function format(expression: Expression | SelectableExpression, parentPrecedence: number): string {
  switch (expression.type) {
    case "literal":
      return formatLiteral(expression.value);
    case "column":
      return expression.qualifier === undefined ? expression.name : `${expression.qualifier}.${expression.name}`;
    case "aggregate":
      return formatAggregate(expression);
    case "unary": {
      const rendered = `${expression.operator}${format(expression.operand, precedence(expression))}`;
      return parenthesize(rendered, precedence(expression), parentPrecedence);
    }
    case "arithmetic": {
      const own = precedence(expression);
      const rendered = `${format(expression.left, own)} ${expression.operator} ${format(expression.right, own + 1)}`;
      return parenthesize(rendered, own, parentPrecedence);
    }
    case "comparison": {
      const own = precedence(expression);
      const rendered = `${format(expression.left, own)} ${expression.operator} ${format(expression.right, own + 1)}`;
      return parenthesize(rendered, own, parentPrecedence);
    }
    case "logical": {
      const own = precedence(expression);
      const rendered = `${format(expression.left, own)} ${expression.operator} ${format(expression.right, own + 1)}`;
      return parenthesize(rendered, own, parentPrecedence);
    }
    case "null_check": {
      const own = precedence(expression);
      const rendered = `${format(expression.operand, own)} IS${expression.negated ? " NOT" : ""} NULL`;
      return parenthesize(rendered, own, parentPrecedence);
    }
  }
}

function formatAggregate(expression: AggregateExpression): string {
  const argument = expression.argument.type === "wildcard" ? "*" : formatExpression(expression.argument);
  return `${expression.function}(${argument})`;
}

function formatLiteral(value: string | number | boolean | null): string {
  if (value === null) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  return `'${value.replaceAll("'", "''")}'`;
}

function precedence(expression: Expression | SelectableExpression): number {
  switch (expression.type) {
    case "logical":
      return expression.operator === "OR" ? 1 : 2;
    case "comparison":
    case "null_check":
      return 3;
    case "arithmetic":
      return expression.operator === "+" || expression.operator === "-" ? 4 : 5;
    case "unary":
      return 6;
    case "literal":
    case "column":
    case "aggregate":
      return 7;
  }
}

function parenthesize(rendered: string, ownPrecedence: number, parentPrecedence: number): string {
  return ownPrecedence < parentPrecedence ? `(${rendered})` : rendered;
}
