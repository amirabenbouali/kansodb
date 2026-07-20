export enum TokenType {
  Select = "SELECT",
  From = "FROM",
  Where = "WHERE",
  And = "AND",
  Or = "OR",
  Order = "ORDER",
  By = "BY",
  Asc = "ASC",
  Desc = "DESC",
  Limit = "LIMIT",
  Identifier = "IDENTIFIER",
  Integer = "INTEGER",
  Decimal = "DECIMAL",
  String = "STRING",
  True = "TRUE",
  False = "FALSE",
  Null = "NULL",
  Star = "STAR",
  Comma = "COMMA",
  Semicolon = "SEMICOLON",
  LeftParen = "LEFT_PAREN",
  RightParen = "RIGHT_PAREN",
  Equal = "EQUAL",
  NotEqual = "NOT_EQUAL",
  Greater = "GREATER",
  GreaterEqual = "GREATER_EQUAL",
  Less = "LESS",
  LessEqual = "LESS_EQUAL",
  Minus = "MINUS",
  Eof = "EOF"
}

export type TokenLiteral = string | number | boolean | null;

export interface Token {
  type: TokenType;
  lexeme: string;
  literal?: TokenLiteral;
  start: number;
  end: number;
}

export const KEYWORDS: ReadonlyMap<string, TokenType> = new Map([
  ["SELECT", TokenType.Select],
  ["FROM", TokenType.From],
  ["WHERE", TokenType.Where],
  ["AND", TokenType.And],
  ["OR", TokenType.Or],
  ["ORDER", TokenType.Order],
  ["BY", TokenType.By],
  ["ASC", TokenType.Asc],
  ["DESC", TokenType.Desc],
  ["LIMIT", TokenType.Limit],
  ["TRUE", TokenType.True],
  ["FALSE", TokenType.False],
  ["NULL", TokenType.Null]
]);
