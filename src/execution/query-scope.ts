import { ExecutionError } from "../errors/execution-error.js";
import type { ColumnReference, TableReference } from "../parser/ast.js";
import type { StoredColumnDefinition } from "../storage/column.js";
import type { Database } from "../storage/database.js";
import type { DatabaseValue, StoredRow } from "../storage/row.js";
import type { Table } from "../storage/table.js";

export interface QueryRelation {
  table: Table;
  tableName: string;
  visibleName: string;
}

export interface ResolvedScopedColumn {
  relation: QueryRelation;
  column: StoredColumnDefinition;
  label: string;
}

export interface JoinedRow {
  relations: Map<string, Readonly<StoredRow> | null>;
}

export class QueryScope {
  private readonly relations: QueryRelation[];
  private readonly relationsByName = new Map<string, QueryRelation>();

  public constructor(relations: readonly QueryRelation[]) {
    this.relations = [...relations];

    for (const relation of this.relations) {
      const key = this.normalize(relation.visibleName);

      if (this.relationsByName.has(key)) {
        throw new ExecutionError({
          code: "DUPLICATE_RELATION",
          message: `Relation alias "${relation.visibleName}" is used more than once.`,
          tableName: relation.tableName
        });
      }

      this.relationsByName.set(key, relation);
    }
  }

  public static fromStatement(database: Database, from: TableReference, joins: readonly TableReference[] = []): QueryScope {
    return new QueryScope([from, ...joins].map((reference) => QueryScope.createRelation(database, reference)));
  }

  public getRelations(): QueryRelation[] {
    return [...this.relations];
  }

  public resolveColumn(reference: ColumnReference): ResolvedScopedColumn {
    if (reference.qualifier !== undefined) {
      return this.resolveQualifiedColumn(reference);
    }

    const matches: ResolvedScopedColumn[] = [];

    for (const relation of this.relations) {
      if (relation.table.hasColumn(reference.name)) {
        matches.push(this.columnForRelation(reference, relation));
      }
    }

    if (matches.length === 0) {
      throw new ExecutionError({
        code: "COLUMN_NOT_FOUND",
        message: `Column "${reference.name}" does not exist in this query.`,
        columnName: reference.name
      });
    }

    if (matches.length > 1) {
      throw new ExecutionError({
        code: "AMBIGUOUS_COLUMN",
        message: `Column "${reference.name}" is ambiguous.`,
        columnName: reference.name
      });
    }

    return matches[0]!;
  }

  public value(row: JoinedRow, column: ResolvedScopedColumn): DatabaseValue {
    const relationRow = row.relations.get(this.normalize(column.relation.visibleName));
    return relationRow?.[column.column.name] ?? null;
  }

  public outputLabel(reference: ColumnReference, column: ResolvedScopedColumn, forceQualified: boolean): string {
    if (reference.qualifier !== undefined || forceQualified) {
      return `${column.relation.visibleName}.${column.column.name}`;
    }

    return column.column.name;
  }

  private static createRelation(database: Database, reference: TableReference): QueryRelation {
    let table: Table;
    try {
      table = database.getTable(reference.name);
    } catch {
      throw new ExecutionError({
        code: "TABLE_NOT_FOUND",
        message: `Table "${reference.name}" was not found`,
        tableName: reference.name
      });
    }

    return {
      table,
      tableName: table.name,
      visibleName: reference.alias ?? table.name
    };
  }

  private resolveQualifiedColumn(reference: ColumnReference): ResolvedScopedColumn {
    const relation = this.relationsByName.get(this.normalize(reference.qualifier!));

    if (relation === undefined) {
      throw new ExecutionError({
        code: "RELATION_NOT_FOUND",
        message: `Relation "${reference.qualifier}" does not exist in this query.`,
        columnName: reference.name
      });
    }

    return this.columnForRelation(reference, relation);
  }

  private columnForRelation(reference: ColumnReference, relation: QueryRelation): ResolvedScopedColumn {
    let column: StoredColumnDefinition;
    try {
      column = relation.table.getColumn(reference.name);
    } catch {
      throw new ExecutionError({
        code: "COLUMN_NOT_FOUND",
        message: `Column "${reference.name}" does not exist on relation "${relation.visibleName}".`,
        tableName: relation.tableName,
        columnName: reference.name
      });
    }

    return {
      relation,
      column,
      label: `${relation.visibleName}.${column.name}`
    };
  }

  private normalize(value: string): string {
    return value.toLowerCase();
  }
}

export function joinedRowFromRelation(relation: QueryRelation, row: Readonly<StoredRow>): JoinedRow {
  return {
    relations: new Map([[relation.visibleName.toLowerCase(), { ...row }]])
  };
}

export function extendJoinedRow(row: JoinedRow, relation: QueryRelation, relationRow: Readonly<StoredRow>): JoinedRow {
  return {
    relations: new Map([...row.relations.entries(), [relation.visibleName.toLowerCase(), { ...relationRow }]])
  };
}

export function extendJoinedRowWithNulls(row: JoinedRow, relation: QueryRelation): JoinedRow {
  return {
    relations: new Map([...row.relations.entries(), [relation.visibleName.toLowerCase(), null]])
  };
}
