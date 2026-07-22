import { ExecutionError } from "../errors/execution-error.js";
import type {
  AggregateExpression,
  AggregateFunctionName,
  ColumnReference,
  Expression,
  JoinClause,
  OrderByExpression,
  OrderByItem,
  SelectExpressionItem,
  SelectItem,
  SelectStatement,
  SelectableExpression
} from "../parser/ast.js";
import { DataType } from "../storage/data-type.js";
import type { Database } from "../storage/database.js";
import type { DatabaseValue } from "../storage/row.js";
import { compareDatabaseValues, evaluateScopedBoolean, evaluateScopedPredicate, evaluateScopedScalar } from "./expression-evaluator.js";
import { formatExpression } from "./expression-formatter.js";
import type { QueryResult } from "./query-result.js";
import {
  extendJoinedRow,
  extendJoinedRowWithNulls,
  joinedRowFromRelation,
  QueryScope,
  type JoinedRow,
  type QueryRelation,
  type ResolvedScopedColumn
} from "./query-scope.js";

interface ResolvedSelectItem {
  item: SelectItem;
  labels: string[];
  expression?: SelectableExpression;
  aggregate?: ResolvedAggregate;
}

interface ResolvedAggregate {
  expression: AggregateExpression;
  label: string;
  argumentColumn?: ResolvedScopedColumn;
}

interface Group {
  rows: JoinedRow[];
  values: DatabaseValue[];
}

interface ProjectedRecord {
  row?: JoinedRow;
  group?: Group;
  result: Record<string, DatabaseValue>;
  index: number;
}

export class JoinExecutor {
  public execute(statement: SelectStatement, database: Database): QueryResult {
    const joinTables = (statement.joins ?? []).map((join) => join.table);
    const scope = QueryScope.fromStatement(database, statement.from, joinTables);
    const relations = scope.getRelations();
    const selectedItems = this.resolveSelectedItems(statement.columns, scope, relations);
    const hasAggregates = selectedItems.some((item) => item.aggregate !== undefined);
    const groupByColumns = this.resolveGroupByColumns(statement.groupBy ?? [], scope);

    this.validateJoinConditions(statement, scope);
    this.validateWhere(statement.where, scope);
    this.validateQueryShape(selectedItems, groupByColumns, hasAggregates);
    this.validateLimit(statement.limit);

    let rows = this.buildJoinedRows(statement, relations, scope);
    if (statement.where !== undefined) {
      rows = rows.filter((row) => evaluateScopedBoolean(statement.where!, { scope, row }));
    }

    const outputColumns = selectedItems.flatMap((item) => item.labels);
    let projected = hasAggregates || statement.groupBy !== undefined
      ? this.projectAggregateRows(rows, selectedItems, groupByColumns, hasAggregates, scope)
      : rows.map((row, index): ProjectedRecord => ({
        row,
        result: this.projectRow(row, selectedItems, scope, relations),
        index
      }));

    if (statement.orderBy !== undefined) {
      projected = this.sortProjected(projected, statement, outputColumns, selectedItems, scope);
    }

    if (statement.limit !== undefined) {
      projected = projected.slice(0, statement.limit);
    }

    const resultRows = projected.map((record) => ({ ...record.result }));
    return {
      type: "query",
      columns: outputColumns,
      rows: resultRows,
      rowCount: resultRows.length
    };
  }

  private buildJoinedRows(statement: SelectStatement, relations: readonly QueryRelation[], scope: QueryScope): JoinedRow[] {
    const baseRelation = relations[0];
    if (baseRelation === undefined) return [];

    let rows = baseRelation.table.getRows().map((row) => joinedRowFromRelation(baseRelation, row));
    for (let index = 0; index < (statement.joins ?? []).length; index += 1) {
      const join = statement.joins![index]!;
      const relation = relations[index + 1]!;
      const nextRows: JoinedRow[] = [];

      for (const leftRow of rows) {
        for (const rightRow of relation.table.getRows()) {
          const candidate = extendJoinedRow(leftRow, relation, rightRow);
          if (this.joinConditionMatches(join, candidate, scope)) {
            nextRows.push(candidate);
          }
        }
      }

      if (join.joinType === "LEFT") {
        rows = this.extendLeftJoinRows(rows, nextRows, relation);
        continue;
      }

      rows = nextRows;
    }

    return rows;
  }

  private joinConditionMatches(join: JoinClause, row: JoinedRow, scope: QueryScope): boolean {
    return evaluateScopedPredicate({
      type: "comparison",
      operator: join.on.operator,
      left: join.on.left,
      right: join.on.right
    }, { scope, row }) === "TRUE";
  }

  private extendLeftJoinRows(leftRows: readonly JoinedRow[], matchedRows: readonly JoinedRow[], relation: QueryRelation): JoinedRow[] {
    return leftRows.flatMap((leftRow) => {
      const relationKey = relation.visibleName.toLowerCase();
      const matches = matchedRows.filter((row) => {
        for (const [key, value] of leftRow.relations.entries()) {
          if (row.relations.get(key) !== value) return false;
        }
        return row.relations.has(relationKey);
      });
      return matches.length > 0 ? matches : [extendJoinedRowWithNulls(leftRow, relation)];
    });
  }

  private resolveSelectedItems(items: readonly SelectItem[], scope: QueryScope, relations: readonly QueryRelation[]): ResolvedSelectItem[] {
    const resolved = items.map((item) => this.resolveSelectItem(item, scope, relations));
    const seen = new Set<string>();
    const explicitAliases = new Set<string>();

    for (const item of resolved) {
      if (item.item.type === "select_expression" && item.item.alias !== undefined) {
        const aliasKey = item.item.alias.toLowerCase();
        if (explicitAliases.has(aliasKey)) {
          throw new ExecutionError({
            code: "DUPLICATE_ALIAS",
            message: `Result alias "${item.item.alias}" is defined more than once.`,
            columnName: item.item.alias
          });
        }
        explicitAliases.add(aliasKey);
      }

      for (const label of item.labels) {
        const key = label.toLowerCase();
        if (seen.has(key)) {
          throw new ExecutionError({
            code: "DUPLICATE_COLUMN",
            message: `Duplicate result column "${label}".`,
            columnName: label
          });
        }
        seen.add(key);
      }
    }

    return resolved;
  }

  private resolveSelectItem(item: SelectItem, scope: QueryScope, relations: readonly QueryRelation[]): ResolvedSelectItem {
    if (item.type === "wildcard") {
      return { item, labels: this.wildcardLabels(relations, relations.length > 1) };
    }

    const expression = item.expression;
    if (expression.type === "aggregate") {
      const aggregate = this.resolveAggregate(expression, scope, item.alias);
      return { item, expression, aggregate, labels: [aggregate.label] };
    }

    if (this.containsAggregate(expression)) {
      throw new ExecutionError({
        code: "INVALID_AGGREGATE_PLACEMENT",
        message: "Aggregate arithmetic is not supported yet."
      });
    }

    this.validateScalarExpression(expression, scope);
    return {
      item,
      expression,
      labels: [this.outputLabelForExpression(item, expression, scope)]
    };
  }

  private outputLabelForExpression(item: SelectExpressionItem, expression: SelectableExpression, scope: QueryScope): string {
    if (item.alias !== undefined) return item.alias;
    if (expression.type === "column") {
      return scope.outputLabel(expression, scope.resolveColumn(expression), false);
    }
    return formatExpression(expression);
  }

  private resolveAggregate(expression: AggregateExpression, scope: QueryScope, alias: string | undefined): ResolvedAggregate {
    if (expression.argument.type === "wildcard") {
      return { expression, label: alias ?? `${expression.function}(*)` };
    }

    const argumentColumn = scope.resolveColumn(expression.argument);
    this.validateAggregateType(expression.function, argumentColumn);
    const argumentLabel = scope.outputLabel(expression.argument, argumentColumn, false);
    return {
      expression,
      argumentColumn,
      label: alias ?? `${expression.function}(${argumentLabel})`
    };
  }

  private resolveGroupByColumns(groupBy: readonly ColumnReference[], scope: QueryScope): ResolvedScopedColumn[] {
    const seen = new Set<string>();
    return groupBy.map((reference) => {
      const column = scope.resolveColumn(reference);
      const key = column.label.toLowerCase();
      if (seen.has(key)) {
        throw new ExecutionError({ code: "DUPLICATE_COLUMN", message: `Duplicate GROUP BY column "${column.label}".`, columnName: column.label });
      }
      seen.add(key);
      return column;
    });
  }

  private validateJoinConditions(statement: SelectStatement, scope: QueryScope): void {
    for (const join of statement.joins ?? []) {
      scope.resolveColumn(join.on.left);
      scope.resolveColumn(join.on.right);
    }
  }

  private validateWhere(expression: Expression | undefined, scope: QueryScope): void {
    if (expression === undefined) return;
    if (this.containsAggregate(expression)) {
      throw new ExecutionError({
        code: "INVALID_AGGREGATE_PLACEMENT",
        message: "Aggregate functions are not allowed in WHERE."
      });
    }
    this.validateScalarExpression(expression, scope);
  }

  private validateScalarExpression(expression: Expression | SelectableExpression, scope: QueryScope): void {
    switch (expression.type) {
      case "literal":
        return;
      case "column":
        scope.resolveColumn(expression);
        return;
      case "aggregate":
        throw new ExecutionError({
          code: "INVALID_AGGREGATE_PLACEMENT",
          message: "Aggregate functions are not allowed in row-level expressions."
        });
      case "unary":
        this.validateScalarExpression(expression.operand, scope);
        return;
      case "arithmetic":
      case "comparison":
      case "logical":
        this.validateScalarExpression(expression.left, scope);
        this.validateScalarExpression(expression.right, scope);
        return;
      case "null_check":
        this.validateScalarExpression(expression.operand, scope);
        return;
    }
  }

  private validateQueryShape(
    selectedItems: readonly ResolvedSelectItem[],
    groupByColumns: readonly ResolvedScopedColumn[],
    hasAggregates: boolean
  ): void {
    if (selectedItems.some((item) => item.item.type === "wildcard") && (hasAggregates || groupByColumns.length > 0)) {
      throw new ExecutionError({ code: "WILDCARD_NOT_ALLOWED", message: "Wildcard selection cannot be mixed with aggregates or GROUP BY." });
    }

    const groupKeys = new Set(groupByColumns.map((column) => column.label.toLowerCase()));
    for (const item of selectedItems) {
      if (item.item.type === "wildcard" || item.aggregate !== undefined) continue;
      if (hasAggregates && groupByColumns.length === 0) {
        throw new ExecutionError({ code: "INVALID_GROUPING", message: `Expression "${item.labels[0]}" must appear in GROUP BY or be used in an aggregate function.` });
      }
      if (groupByColumns.length > 0) {
        if (item.expression?.type !== "column") {
          throw new ExecutionError({ code: "INVALID_GROUPING", message: `Expression "${item.labels[0]}" must appear in GROUP BY or be used in an aggregate function.` });
        }
        const label = item.expression === undefined ? "" : scopeKeyForColumn(item.expression, groupByColumns);
        if (!groupKeys.has(label)) {
          throw new ExecutionError({ code: "INVALID_GROUPING", message: `Column "${item.labels[0]}" must appear in GROUP BY or be used in an aggregate function.` });
        }
      }
    }
  }

  private projectRow(
    row: JoinedRow,
    selectedItems: readonly ResolvedSelectItem[],
    scope: QueryScope,
    relations: readonly QueryRelation[]
  ): Record<string, DatabaseValue> {
    const projected: Record<string, DatabaseValue> = {};
    for (const item of selectedItems) {
      if (item.item.type === "wildcard") {
        this.projectWildcard(projected, row, relations, relations.length > 1);
        continue;
      }
      if (item.expression !== undefined) {
        projected[item.labels[0]!] = evaluateScopedScalar(item.expression, { scope, row });
      }
    }
    return projected;
  }

  private projectAggregateRows(
    rows: readonly JoinedRow[],
    selectedItems: readonly ResolvedSelectItem[],
    groupByColumns: readonly ResolvedScopedColumn[],
    hasAggregates: boolean,
    scope: QueryScope
  ): ProjectedRecord[] {
    return this.buildGroups(rows, groupByColumns, hasAggregates, scope).map((group, index): ProjectedRecord => {
      const result: Record<string, DatabaseValue> = {};
      const representative = group.rows[0];
      for (const item of selectedItems) {
        if (item.aggregate !== undefined) {
          result[item.labels[0]!] = this.computeAggregate(item.aggregate, group.rows, scope);
        } else if (item.expression !== undefined) {
          result[item.labels[0]!] = representative === undefined ? null : evaluateScopedScalar(item.expression, { scope, row: representative });
        }
      }
      return { group, result, index };
    });
  }

  private buildGroups(
    rows: readonly JoinedRow[],
    groupByColumns: readonly ResolvedScopedColumn[],
    hasAggregates: boolean,
    scope: QueryScope
  ): Group[] {
    if (groupByColumns.length === 0) return hasAggregates ? [{ rows: [...rows], values: [] }] : [];

    const groups: Group[] = [];
    const byKey = new Map<string, Group>();
    for (const row of rows) {
      const values = groupByColumns.map((column) => this.valueForGroupKey(row, column, scope));
      const key = JSON.stringify(values.map((value) => [value === null ? "null" : typeof value, value]));
      const existing = byKey.get(key);
      if (existing !== undefined) {
        existing.rows.push(row);
      } else {
        const group = { rows: [row], values };
        byKey.set(key, group);
        groups.push(group);
      }
    }
    return groups;
  }

  private sortProjected(
    records: readonly ProjectedRecord[],
    statement: SelectStatement,
    outputColumns: readonly string[],
    selectedItems: readonly ResolvedSelectItem[],
    scope: QueryScope
  ): ProjectedRecord[] {
    const firstRecord = records[0];
    if (firstRecord !== undefined) {
      for (const item of statement.orderBy!.items) {
        this.resolveOrderValue(item.expression, firstRecord, outputColumns, selectedItems, scope);
      }
    }

    return records
      .map((record, stableIndex) => ({ record, stableIndex }))
      .sort((left, right) => {
        for (const item of statement.orderBy!.items) {
          const leftValue = this.resolveOrderValue(item.expression, left.record, outputColumns, selectedItems, scope);
          const rightValue = this.resolveOrderValue(item.expression, right.record, outputColumns, selectedItems, scope);
          const comparison = this.compareOrderValues(leftValue, rightValue, item);
          if (comparison !== 0) {
            if (leftValue === null || rightValue === null) return comparison;
            return item.direction === "ASC" ? comparison : -comparison;
          }
        }
        return left.stableIndex - right.stableIndex;
      })
      .map((entry) => entry.record);
  }

  private resolveOrderValue(
    expression: OrderByExpression,
    record: ProjectedRecord,
    outputColumns: readonly string[],
    selectedItems: readonly ResolvedSelectItem[],
    scope: QueryScope
  ): DatabaseValue {
    switch (expression.type) {
      case "ordinal": {
        const label = outputColumns[expression.position - 1];
        if (label === undefined) {
          throw new ExecutionError({
            code: "ORDER_BY_POSITION_OUT_OF_RANGE",
            message: `ORDER BY position ${expression.position} is outside the ${outputColumns.length}-column select list.`
          });
        }
        return record.result[label] ?? null;
      }
      case "result_alias": {
        const resultLabel = this.findResultLabel(expression.name, outputColumns);
        if (resultLabel !== undefined) return record.result[resultLabel] ?? null;
        return this.resolveSourceOrderValue({ type: "column", name: expression.name }, record, scope);
      }
      case "column": {
        const resultLabel = this.findResultLabel(formatExpression(expression), outputColumns);
        if (resultLabel !== undefined) return record.result[resultLabel] ?? null;
        return this.resolveSourceOrderValue(expression, record, scope);
      }
      case "aggregate": {
        const selected = selectedItems.find((item) =>
          item.aggregate !== undefined && this.sameAggregate(item.aggregate.expression, expression)
        );
        if (selected === undefined) {
          throw new ExecutionError({ code: "INVALID_ORDER_BY", message: `ORDER BY aggregate "${formatExpression(expression)}" must appear in the select list.` });
        }
        return record.result[selected.labels[0]!] ?? null;
      }
    }
  }

  private resolveSourceOrderValue(column: ColumnReference, record: ProjectedRecord, scope: QueryScope): DatabaseValue {
    if (record.group !== undefined) {
      throw new ExecutionError({
        code: "INVALID_ORDER_BY",
        message: `ORDER BY column "${formatExpression(column)}" must appear in the aggregate result.`
      });
    }
    const resolved = scope.resolveColumn(column);
    const row = record.row;
    if (row === undefined) return null;
    return scope.value(row, resolved);
  }

  private findResultLabel(name: string, outputColumns: readonly string[]): string | undefined {
    return outputColumns.find((column) => column.toLowerCase() === name.toLowerCase());
  }

  private computeAggregate(aggregate: ResolvedAggregate, rows: readonly JoinedRow[], scope: QueryScope): DatabaseValue {
    if (aggregate.expression.function === "COUNT") {
      if (aggregate.expression.argument.type === "wildcard") return rows.length;
      return this.nonNullValues(aggregate, rows, scope).length;
    }

    const values = this.nonNullValues(aggregate, rows, scope);
    if (values.length === 0) return null;

    switch (aggregate.expression.function) {
      case "SUM":
        return values.reduce<number>((sum, value) => sum + this.asNumber(value), 0);
      case "AVG":
        return values.reduce<number>((sum, value) => sum + this.asNumber(value), 0) / values.length;
      case "MIN":
        return values.reduce((min, value) => compareDatabaseValues(value, min) < 0 ? value : min);
      case "MAX":
        return values.reduce((max, value) => compareDatabaseValues(value, max) > 0 ? value : max);
    }
  }

  private nonNullValues(aggregate: ResolvedAggregate, rows: readonly JoinedRow[], scope: QueryScope): Exclude<DatabaseValue, null>[] {
    if (aggregate.argumentColumn === undefined) {
      throw new ExecutionError({ code: "INVALID_AGGREGATE_ARGUMENT", message: "Aggregate requires a column argument." });
    }
    return rows
      .map((row) => scope.value(row, aggregate.argumentColumn!))
      .filter((value): value is Exclude<DatabaseValue, null> => value !== null);
  }

  private containsAggregate(expression: Expression | SelectableExpression): boolean {
    switch (expression.type) {
      case "aggregate":
        return true;
      case "arithmetic":
      case "comparison":
      case "logical":
        return this.containsAggregate(expression.left) || this.containsAggregate(expression.right);
      case "null_check":
        return this.containsAggregate(expression.operand);
      case "unary":
        return this.containsAggregate(expression.operand);
      case "literal":
      case "column":
        return false;
    }
  }

  private sameAggregate(left: AggregateExpression, right: AggregateExpression): boolean {
    return formatExpression(left).toLowerCase() === formatExpression(right).toLowerCase();
  }

  private validateAggregateType(functionName: AggregateFunctionName, column: ResolvedScopedColumn): void {
    if ((functionName === "SUM" || functionName === "AVG") && column.column.type !== DataType.INTEGER && column.column.type !== DataType.DECIMAL) {
      throw new ExecutionError({
        code: "INVALID_AGGREGATE_TYPE",
        message: `${functionName} cannot be applied to ${column.column.type} column "${column.label}".`,
        columnName: column.label
      });
    }
  }

  private asNumber(value: Exclude<DatabaseValue, null>): number {
    if (typeof value !== "number") {
      throw new ExecutionError({ code: "INVALID_AGGREGATE_TYPE", message: `Expected numeric value, received ${typeof value}.` });
    }
    return value;
  }

  private validateLimit(limit: number | undefined): void {
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 0)) {
      throw new ExecutionError({ code: "INVALID_LIMIT", message: `LIMIT must be a non-negative integer, received ${String(limit)}` });
    }
  }

  private wildcardLabels(relations: readonly QueryRelation[], forceQualified: boolean): string[] {
    return relations.flatMap((relation) => relation.table.getSchema().map((column) => forceQualified ? `${relation.visibleName}.${column.name}` : column.name));
  }

  private projectWildcard(projected: Record<string, DatabaseValue>, row: JoinedRow, relations: readonly QueryRelation[], forceQualified: boolean): void {
    for (const relation of relations) {
      const relationRow = row.relations.get(relation.visibleName.toLowerCase());
      for (const column of relation.table.getSchema()) {
        const label = forceQualified ? `${relation.visibleName}.${column.name}` : column.name;
        projected[label] = relationRow?.[column.name] ?? null;
      }
    }
  }

  private valueForGroupKey(row: JoinedRow, column: ResolvedScopedColumn, scope: QueryScope): DatabaseValue {
    return scope.value(row, column);
  }

  private compareOrderValues(left: DatabaseValue, right: DatabaseValue, item: OrderByItem): number {
    if (left === null && right === null) return 0;
    const nulls = item.nulls ?? (item.direction === "ASC" ? "LAST" : "FIRST");
    if (left === null) return nulls === "FIRST" ? -1 : 1;
    if (right === null) return nulls === "FIRST" ? 1 : -1;
    return compareDatabaseValues(left, right);
  }
}

function scopeKeyForColumn(column: ColumnReference, groupByColumns: readonly ResolvedScopedColumn[]): string {
  return groupByColumns.find((groupColumn) => {
    if (column.qualifier !== undefined && groupColumn.relation.visibleName.toLowerCase() !== column.qualifier.toLowerCase()) {
      return false;
    }
    return groupColumn.column.name.toLowerCase() === column.name.toLowerCase();
  })?.label.toLowerCase() ?? "";
}
