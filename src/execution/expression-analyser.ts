import type { Expression } from "../parser/ast.js";

export type ExpressionDataType = "INTEGER" | "DECIMAL" | "TEXT" | "BOOLEAN" | "NULL" | "UNKNOWN";

export interface AnalysedExpression {
  dataType: ExpressionDataType;
  nullable: boolean;
  category: "scalar" | "predicate";
}

export function analyseExpression(expression: Expression): AnalysedExpression {
  switch (expression.type) {
    case "literal":
      return {
        dataType: expression.value === null ? "NULL" : typeof expression.value === "boolean" ? "BOOLEAN" : typeof expression.value === "number" ? "DECIMAL" : "TEXT",
        nullable: expression.value === null,
        category: typeof expression.value === "boolean" ? "predicate" : "scalar"
      };
    case "comparison":
    case "logical":
    case "null_check":
      return { dataType: "BOOLEAN", nullable: expression.type !== "null_check", category: "predicate" };
    case "column":
    case "unary":
    case "arithmetic":
    case "aggregate":
      return { dataType: "UNKNOWN", nullable: true, category: "scalar" };
  }
}
