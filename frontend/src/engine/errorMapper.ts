import {
  ExecutionError
} from "../../../src/errors/execution-error.ts";
import { LexerError } from "../../../src/errors/lexer-error.ts";
import { ParserError } from "../../../src/errors/parser-error.ts";
import { PersistenceError } from "../../../src/errors/persistence-error.ts";
import { ScriptError } from "../../../src/errors/script-error.ts";
import { StorageError } from "../../../src/errors/storage-error.ts";
import { TransactionError } from "../../../src/errors/transaction-error.ts";
import type { KansoErrorView } from "../features/execution/executionTypes";

export function mapKansoError(error: unknown, fallbackCode = "UNKNOWN_ERROR"): KansoErrorView {
  if (error instanceof LexerError) {
    return {
      code: "LEXER_ERROR",
      message: error.message,
      metadata: { position: error.position }
    };
  }

  if (error instanceof ParserError) {
    return {
      code: "PARSER_ERROR",
      message: error.message,
      metadata: {
        start: error.start,
        end: error.end,
        unexpectedToken: error.token.type,
        ...(error.expected === undefined ? {} : { expected: [...error.expected] })
      }
    };
  }

  if (
    error instanceof ExecutionError
    || error instanceof StorageError
    || error instanceof ScriptError
    || error instanceof TransactionError
    || error instanceof PersistenceError
  ) {
    return withOptionalMetadata({
      code: error.code,
      message: error.message,
    }, collectErrorMetadata(error));
  }

  if (error instanceof Error) {
    return {
      code: fallbackCode,
      message: error.message,
      metadata: { name: error.name }
    };
  }

  return {
    code: fallbackCode,
    message: "An unknown KansoDB error occurred."
  };
}

function collectErrorMetadata(error: object): Record<string, unknown> | undefined {
  const metadata: Record<string, unknown> = {};

  for (const key of [
    "tableName",
    "columnName",
    "referencedTableName",
    "referencedColumnName",
    "referencingTableName",
    "referencingColumnName",
    "operator",
    "value",
    "currentState",
    "attemptedAction",
    "atomic",
    "statementType",
    "path",
    "rowIndex",
    "foundVersion",
    "supportedVersions",
    "databaseStateCommitted",
    "persistenceSucceeded"
  ]) {
    if (key in error) {
      const value = error[key as keyof typeof error];
      if (value !== undefined) {
        metadata[key] = value;
      }
    }
  }

  return Object.keys(metadata).length === 0 ? undefined : metadata;
}

function withOptionalMetadata(error: Omit<KansoErrorView, "metadata">, metadata: Record<string, unknown> | undefined): KansoErrorView {
  return metadata === undefined ? error : { ...error, metadata };
}
