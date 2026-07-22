import { LexerError } from "../../../../src/errors/lexer-error.ts";
import { ParserError } from "../../../../src/errors/parser-error.ts";
import { Lexer } from "../../../../src/lexer/lexer.ts";
import type { Token } from "../../../../src/lexer/token.ts";
import { KEYWORDS, TokenType } from "../../../../src/lexer/token.ts";
import { Parser } from "../../../../src/parser/parser.ts";
import { ScriptParser } from "../../../../src/parser/script-parser.ts";
import type {
  CreateTableStatement,
  DeleteStatement,
  Expression,
  InsertStatement,
  OrderByExpression,
  SelectItem,
  SelectStatement,
  Statement,
  UpdateStatement
} from "../../../../src/parser/ast.ts";
import type { DatabaseSnapshot, TableSnapshot } from "../../../../src/storage/transaction.ts";
import type { KansoExecutionResult, KansoScriptExecutionResult } from "../../features/execution/executionTypes";
import type {
  AstTraceProperty,
  AstTraceView,
  ExecutionOperatorView,
  ExecutionTrace,
  ExecutionTraceStage,
  ExecutionTraceStageId,
  ResultSummaryView,
  StorageReadView,
  TokenTraceCategory,
  TokenTraceView
} from "./traceTypes";
import { TRACE_STAGE_ORDER } from "./traceTypes";

const MAX_AST_DEPTH = 8;
const MAX_AST_CHILDREN = 80;

export interface ParsedTraceMetadata {
  ast: AstTraceView;
  operators: ExecutionOperatorView[];
  statement: Statement;
  tokens: TokenTraceView[];
}

export interface ScriptTraceMetadata {
  ast: AstTraceView;
  operators: ExecutionOperatorView[];
  statements: Statement[];
  tokens: TokenTraceView[];
}

export function createBaseTrace(sql: string): ExecutionTrace {
  return {
    stages: [
      {
        id: "sql",
        status: "complete",
        summary: sql.trim().length === 0 ? "Empty SQL" : `${sql.length} characters`
      },
      ...TRACE_STAGE_ORDER.filter((id) => id !== "sql").map((id): ExecutionTraceStage => ({ id, status: "skipped" }))
    ]
  };
}

export function completeStage(
  trace: ExecutionTrace,
  stageId: ExecutionTraceStageId,
  summary: string,
  durationMs?: number
): ExecutionTrace {
  return {
    ...trace,
    stages: trace.stages.map((stage) => stage.id === stageId
      ? withOptionalDuration({ ...stage, status: "complete", summary }, durationMs)
      : stage)
  };
}

export function failTrace(trace: ExecutionTrace, stageId: ExecutionTraceStageId, summary: string): ExecutionTrace {
  let found = false;

  return {
    ...trace,
    stages: trace.stages.map((stage) => {
      if (stage.id === stageId) {
        found = true;
        return { ...stage, status: "failed", summary };
      }

      if (found) {
        return { ...stage, status: "skipped", summary: "Skipped after failure" };
      }

      return stage;
    })
  };
}

export function attachTokens(trace: ExecutionTrace, tokens: readonly Token[]): ExecutionTrace {
  return { ...trace, tokens: tokens.map(mapToken) };
}

export function parseStatementTrace(tokens: readonly Token[], beforeSnapshot: DatabaseSnapshot): ParsedTraceMetadata {
  const statement = new Parser([...tokens]).parse();
  return {
    statement,
    tokens: tokens.map(mapToken),
    ast: mapAst(statement),
    operators: buildOperators(statement, beforeSnapshot)
  };
}

export function parseScriptTrace(tokens: readonly Token[], sql: string, beforeSnapshot: DatabaseSnapshot): ScriptTraceMetadata {
  const statements = new ScriptParser([...tokens], sql).parse();
  return {
    statements,
    tokens: tokens.map(mapToken),
    ast: mapAst({ type: "script", statements }),
    operators: statements.map((statement, index) => ({
      id: `script-${index}`,
      kind: "script",
      label: `Statement ${index + 1}`,
      detail: statement.type,
      children: buildOperators(statement, beforeSnapshot)
    }))
  };
}

export function collectStorageReads(
  statement: Statement,
  result: KansoExecutionResult,
  beforeSnapshot: DatabaseSnapshot,
  afterSnapshot: DatabaseSnapshot
): StorageReadView[] {
  switch (statement.type) {
    case "select":
      return selectTables(statement).map((tableName, index) => ({
        id: `storage-scan-${index}`,
        activity: "table_access",
        tableName,
        rowsInspected: rowCount(beforeSnapshot, tableName),
        detail: "Rows read from table storage"
      }));
    case "insert":
      return rowsChanged(statement.tableName, result, beforeSnapshot, afterSnapshot, "Inserted row");
    case "update":
      return rowsChanged(statement.tableName, result, beforeSnapshot, afterSnapshot, "Updated rows", rowCount(beforeSnapshot, statement.tableName));
    case "delete":
      return rowsChanged(statement.tableName, result, beforeSnapshot, afterSnapshot, "Deleted rows", rowCount(beforeSnapshot, statement.tableName));
    case "create_table":
      return [{
        id: "storage-schema-create",
        activity: "schema_changed",
        tableName: statement.tableName,
        detail: "Table schema added"
      }];
    case "begin_transaction":
      return [{ id: "storage-transaction-begin", activity: "snapshot_created", detail: "Transaction snapshot created" }];
    case "commit_transaction":
      return [{ id: "storage-transaction-commit", activity: "snapshot_created", detail: "Transaction state committed" }];
    case "rollback_transaction":
      return [{ id: "storage-transaction-rollback", activity: "snapshot_restored", detail: "Transaction snapshot restored" }];
    case "save_database":
      return result.type === "persistence"
        ? [{ id: "storage-file-saved", activity: "file_saved", detail: result.path, rowsChanged: result.bytesWritten }]
        : [];
  }
}

export function collectScriptStorageReads(
  result: KansoScriptExecutionResult,
  beforeSnapshot: DatabaseSnapshot,
  afterSnapshot: DatabaseSnapshot
): StorageReadView[] {
  const changedTables = afterSnapshot.tables.flatMap((table) => {
    const beforeRows = rowCount(beforeSnapshot, table.name);
    const afterRows = table.rows.length;
    return beforeRows === afterRows ? [] : [{
      id: `storage-script-${table.name}`,
      activity: "rows_changed" as const,
      tableName: table.name,
      rowsInspected: beforeRows,
      rowsChanged: Math.abs(afterRows - beforeRows),
      detail: "Script changed row count"
    }];
  });

  if (changedTables.length > 0) {
    return changedTables;
  }

  return result.statements.some((record) => record.status === "success")
    ? [{ id: "storage-script", activity: "table_access", detail: "Script completed without row-count changes" }]
    : [];
}

export function resultSummary(result: KansoExecutionResult | KansoScriptExecutionResult): ResultSummaryView {
  switch (result.type) {
    case "query":
      return { resultType: "query", rowCount: result.rowCount };
    case "mutation":
      return { resultType: "mutation", affectedRows: result.affectedRows };
    case "schema":
      return { resultType: "schema" };
    case "transaction":
      return { resultType: "transaction", transactionState: result.state };
    case "persistence":
      return { resultType: "persistence", savePath: result.path, bytesWritten: result.bytesWritten };
    case "script":
      return {
        resultType: "script",
        script: {
          succeeded: result.succeeded,
          failed: result.failed,
          skipped: result.skipped,
          atomic: result.atomic,
          committed: result.committed,
          rolledBack: result.rolledBack
        }
      };
  }
}

export function executionFailureStage(error: unknown): ExecutionTraceStageId {
  if (error instanceof LexerError) {
    return "lexer";
  }

  if (error instanceof ParserError) {
    return "parser";
  }

  if (isStorageConstraintError(error)) {
    return "storage";
  }

  return "executor";
}

export function lexSql(sql: string): Token[] {
  return new Lexer(sql).tokenize();
}

function buildOperators(statement: Statement, beforeSnapshot: DatabaseSnapshot): ExecutionOperatorView[] {
  switch (statement.type) {
    case "select":
      return [buildSelectOperator(statement, beforeSnapshot)];
    case "insert":
      return [mutationOperator("insert", "Insert", statement.tableName, "Add one row")];
    case "update":
      return [mutationOperator("update", "Update", statement.tableName, statement.where === undefined ? "Update all rows" : "Update rows matching WHERE")];
    case "delete":
      return [mutationOperator("delete", "Delete", statement.tableName, statement.where === undefined ? "Delete all rows" : "Delete rows matching WHERE")];
    case "create_table":
      return [createTableOperator(statement)];
    case "begin_transaction":
      return [{ id: "operator-transaction-begin", kind: "transaction", label: "Begin Transaction", detail: "Create transaction snapshot" }];
    case "commit_transaction":
      return [{ id: "operator-transaction-commit", kind: "transaction", label: "Commit Transaction", detail: "Commit transaction state" }];
    case "rollback_transaction":
      return [{ id: "operator-transaction-rollback", kind: "transaction", label: "Rollback Transaction", detail: "Restore transaction snapshot" }];
    case "save_database":
      return [{ id: "operator-save", kind: "persistence", label: "Save Database", detail: "Persist storage snapshot" }];
  }
}

function buildSelectOperator(statement: SelectStatement, beforeSnapshot: DatabaseSnapshot): ExecutionOperatorView {
  let current = scanOperator(statement.from.name, beforeSnapshot);

  if (statement.joins !== undefined && statement.joins.length > 0) {
    current = statement.joins.reduce((left, join, index): ExecutionOperatorView => ({
      id: `operator-join-${index}`,
      kind: "join",
      label: `${join.joinType} Join`,
      detail: `${formatColumn(join.on.left)} = ${formatColumn(join.on.right)}`,
      children: [left, scanOperator(join.table.name, beforeSnapshot)]
    }), current);
  }

  if (statement.where !== undefined) {
    current = {
      id: "operator-filter",
      kind: "filter",
      label: "Filter",
      detail: formatExpression(statement.where),
      children: [current]
    };
  }

  if (statement.groupBy !== undefined && statement.groupBy.length > 0) {
    current = {
      id: "operator-group",
      kind: "group",
      label: "Group",
      detail: statement.groupBy.map(formatColumn).join(", "),
      children: [current]
    };
  }

  if (statement.columns.some(selectItemHasAggregate)) {
    current = {
      id: "operator-aggregate",
      kind: "aggregate",
      label: "Aggregate",
      detail: statement.columns.map(formatSelectItem).join(", "),
      children: [current]
    };
  }

  current = {
    id: "operator-projection",
    kind: "projection",
    label: "Projection",
    detail: statement.columns.map(formatSelectItem).join(", "),
    children: [current]
  };

  if (statement.orderBy !== undefined) {
    current = {
      id: "operator-sort",
      kind: "sort",
      label: "Sort",
      detail: statement.orderBy.items.map((item) => `${formatExpression(item.expression)} ${item.direction}`).join(", "),
      children: [current]
    };
  }

  if (statement.limit !== undefined) {
    current = {
      id: "operator-limit",
      kind: "limit",
      label: "Limit",
      detail: String(statement.limit),
      outputRows: statement.limit,
      children: [current]
    };
  }

  return current;
}

function scanOperator(tableName: string, beforeSnapshot: DatabaseSnapshot): ExecutionOperatorView {
  const rows = rowCount(beforeSnapshot, tableName);
  return {
    id: `operator-scan-${tableName}`,
    kind: "table_scan",
    label: "Table Scan",
    tableName,
    inputRows: rows,
    outputRows: rows,
    detail: `${tableName} · ${rows} rows`
  };
}

function mutationOperator(
  kind: "insert" | "update" | "delete",
  label: string,
  tableName: string,
  detail: string
): ExecutionOperatorView {
  return {
    id: `operator-${kind}-${tableName}`,
    kind,
    label,
    tableName,
    detail
  };
}

function createTableOperator(statement: CreateTableStatement): ExecutionOperatorView {
  return {
    id: `operator-create-${statement.tableName}`,
    kind: "create_table",
    label: "Create Table",
    tableName: statement.tableName,
    detail: `${statement.columns.length} columns`
  };
}

function mapToken(token: Token): TokenTraceView {
  const view: TokenTraceView = {
    type: token.type,
    lexeme: token.lexeme,
    start: token.start,
    end: token.end,
    category: tokenCategory(token)
  };

  if ("literal" in token) {
    view.literal = token.literal;
  }

  return view;
}

function tokenCategory(token: Token): TokenTraceCategory {
  if (token.type === TokenType.Eof) {
    return "eof";
  }

  if (token.type === TokenType.Identifier) {
    return "identifier";
  }

  if ([TokenType.Integer, TokenType.Decimal, TokenType.String, TokenType.True, TokenType.False, TokenType.Null].includes(token.type)) {
    return "literal";
  }

  if ([TokenType.Equal, TokenType.NotEqual, TokenType.Greater, TokenType.GreaterEqual, TokenType.Less, TokenType.LessEqual, TokenType.Plus, TokenType.Minus, TokenType.Slash, TokenType.Percent].includes(token.type)) {
    return "operator";
  }

  return Array.from(KEYWORDS.values()).includes(token.type) ? "keyword" : "symbol";
}

function mapAst(value: unknown, label = "statement", depth = 0, counter = { value: 0 }): AstTraceView {
  const id = `ast-${counter.value}`;
  counter.value += 1;

  if (depth > MAX_AST_DEPTH) {
    return { id, label, type: "truncated", properties: [{ key: "value", value: "Max depth reached" }], children: [], truncated: true };
  }

  if (!isRecord(value)) {
    return {
      id,
      label,
      type: primitiveType(value),
      properties: [{ key: "value", value: scalarValue(value) }],
      children: []
    };
  }

  const properties: AstTraceProperty[] = [];
  const children: AstTraceView[] = [];

  for (const [key, childValue] of Object.entries(value)) {
    if (isScalar(childValue)) {
      properties.push({ key, value: scalarValue(childValue) });
      continue;
    }

    if (Array.isArray(childValue)) {
      children.push(...childValue.slice(0, MAX_AST_CHILDREN - children.length).map((item, index) => mapAst(item, `${key}[${index}]`, depth + 1, counter)));
      if (childValue.length > MAX_AST_CHILDREN) {
        children.push({
          id: `ast-${counter.value++}`,
          label: key,
          type: "truncated",
          properties: [{ key: "remaining", value: childValue.length - MAX_AST_CHILDREN }],
          children: [],
          truncated: true
        });
      }
      continue;
    }

    children.push(mapAst(childValue, key, depth + 1, counter));
  }

  return {
    id,
    label,
    type: typeof value.type === "string" ? value.type : "object",
    properties,
    children
  };
}

function rowsChanged(
  tableName: string,
  result: KansoExecutionResult,
  beforeSnapshot: DatabaseSnapshot,
  afterSnapshot: DatabaseSnapshot,
  detail: string,
  rowsInspected?: number
): StorageReadView[] {
  const beforeRows = rowCount(beforeSnapshot, tableName);
  const afterRows = rowCount(afterSnapshot, tableName);
  const affectedRows = result.type === "mutation" ? result.affectedRows : Math.abs(afterRows - beforeRows);

  return [{
    id: `storage-change-${tableName}`,
    activity: "rows_changed",
    tableName,
    ...(rowsInspected === undefined ? {} : { rowsInspected }),
    rowsChanged: affectedRows,
    detail
  }];
}

function rowCount(snapshot: DatabaseSnapshot, tableName: string): number {
  return table(snapshot, tableName)?.rows.length ?? 0;
}

function table(snapshot: DatabaseSnapshot, tableName: string): TableSnapshot | undefined {
  return snapshot.tables.find((candidate) => candidate.name.toLowerCase() === tableName.toLowerCase());
}

function selectTables(statement: SelectStatement): string[] {
  return [statement.from.name, ...(statement.joins ?? []).map((join) => join.table.name)];
}

function formatSelectItem(item: SelectItem): string {
  if (item.type === "wildcard") {
    return "*";
  }

  const expression = formatExpression(item.expression);
  return item.alias === undefined ? expression : `${expression} AS ${item.alias}`;
}

function selectItemHasAggregate(item: SelectItem): boolean {
  return item.type === "select_expression" && item.expression.type === "aggregate";
}

function formatExpression(expression: Expression | OrderByExpression): string {
  switch (expression.type) {
    case "literal":
      return expression.value === null ? "NULL" : String(expression.value);
    case "column":
      return formatColumn(expression);
    case "aggregate":
      return `${expression.function}(${expression.argument.type === "wildcard" ? "*" : formatColumn(expression.argument)})`;
    case "comparison":
      return `${formatExpression(expression.left)} ${expression.operator} ${formatExpression(expression.right)}`;
    case "logical":
      return `${formatExpression(expression.left)} ${expression.operator} ${formatExpression(expression.right)}`;
    case "null_check":
      return `${formatExpression(expression.operand)} IS ${expression.negated ? "NOT " : ""}NULL`;
    case "unary":
      return `${expression.operator}${formatExpression(expression.operand)}`;
    case "arithmetic":
      return `${formatExpression(expression.left)} ${expression.operator} ${formatExpression(expression.right)}`;
    case "result_alias":
      return expression.name;
    case "ordinal":
      return String(expression.position);
  }
}

function formatColumn(column: { name: string; qualifier?: string }): string {
  return column.qualifier === undefined ? column.name : `${column.qualifier}.${column.name}`;
}

function withOptionalDuration(stage: ExecutionTraceStage, durationMs: number | undefined): ExecutionTraceStage {
  return durationMs === undefined ? stage : { ...stage, durationMs };
}

function isStorageConstraintError(error: unknown): boolean {
  if (!isRecord(error) || typeof error.code !== "string") {
    return false;
  }

  return error.code.includes("CONSTRAINT")
    || error.code.includes("PRIMARY_KEY")
    || error.code.includes("FOREIGN_KEY")
    || error.code === "REFERENCED_ROW_EXISTS"
    || error.code === "NOT_NULL_VIOLATION";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isScalar(value: unknown): value is string | number | boolean | null | undefined {
  return value === null || value === undefined || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function scalarValue(value: unknown): string | number | boolean | null {
  return value === undefined ? "undefined" : value as string | number | boolean | null;
}

function primitiveType(value: unknown): string {
  return value === null ? "null" : typeof value;
}
