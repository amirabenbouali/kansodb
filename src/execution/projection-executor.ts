import type { SelectExpressionItem } from "../parser/ast.js";
import type { DatabaseValue } from "../storage/row.js";
import { evaluateScopedScalar } from "./expression-evaluator.js";
import { formatExpression } from "./expression-formatter.js";
import type { JoinedRow, QueryScope } from "./query-scope.js";

export interface ProjectionItem {
  item: SelectExpressionItem;
  label?: string;
}

export class ProjectionExecutor {
  public project(
    items: readonly ProjectionItem[],
    rows: readonly JoinedRow[],
    scope: QueryScope
  ): Array<Record<string, DatabaseValue>> {
    return rows.map((row) => {
      const projected: Record<string, DatabaseValue> = {};

      for (const item of items) {
        const label = item.label ?? item.item.alias ?? formatExpression(item.item.expression);
        projected[label] = evaluateScopedScalar(item.item.expression, { scope, row });
      }

      return projected;
    });
  }
}
