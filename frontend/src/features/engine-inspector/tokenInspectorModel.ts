export interface TokenInspectorToken {
  type: string;
  lexeme: string;
  literal?: string | number | boolean | null;
  category: "keyword" | "identifier" | "literal" | "symbol" | "operator" | "eof";
}

export type TokenDisplayCategory = "keyword" | "identifier" | "number" | "string" | "boolean" | "null" | "operator" | "symbol" | "eof";

export function filterTokens<T extends TokenInspectorToken>(tokens: readonly T[], search: string): T[] {
  const query = search.trim().toLowerCase();
  if (query.length === 0) {
    return [...tokens];
  }

  return tokens.filter((token) => {
    return token.lexeme.toLowerCase().includes(query) || token.type.toLowerCase().includes(query) || getTokenKindLabel(token).toLowerCase().includes(query);
  });
}

export function getTokenKindLabel(token: TokenInspectorToken): string {
  switch (getTokenDisplayCategory(token)) {
    case "keyword":
      return "Keyword";
    case "identifier":
      return "Identifier";
    case "number":
      return "Number";
    case "string":
      return "String";
    case "boolean":
      return "Boolean";
    case "null":
      return "Null";
    case "operator":
      return "Operator";
    case "eof":
      return "EOF";
    case "symbol":
      return getSymbolLabel(token.type);
  }
}

export function getTokenDescription(token: TokenInspectorToken): string {
  switch (getTokenDisplayCategory(token)) {
    case "keyword":
      return "Reserved SQL keyword.";
    case "identifier":
      return "User-defined table, column, or relation name.";
    case "number":
      return "Numeric literal.";
    case "string":
      return "String literal.";
    case "boolean":
      return "Boolean literal.";
    case "null":
      return "NULL literal.";
    case "operator":
      return "Comparison or arithmetic operator.";
    case "eof":
      return "End of token stream.";
    case "symbol":
      return getSymbolDescription(token.type);
  }
}

export function getTokenDisplayCategory(token: TokenInspectorToken): TokenDisplayCategory {
  if (token.category === "literal") {
    if (token.type === "INTEGER" || token.type === "DECIMAL") return "number";
    if (token.type === "STRING") return "string";
    if (token.type === "TRUE" || token.type === "FALSE") return "boolean";
    if (token.type === "NULL") return "null";
  }

  if (token.category === "operator" || token.category === "keyword" || token.category === "identifier" || token.category === "eof") {
    return token.category;
  }

  return "symbol";
}

function getSymbolLabel(type: string): string {
  switch (type) {
    case "COMMA":
      return "Comma";
    case "SEMICOLON":
      return "Semicolon";
    case "LEFT_PAREN":
    case "RIGHT_PAREN":
      return "Parenthesis";
    case "STAR":
      return "Symbol";
    default:
      return "Symbol";
  }
}

function getSymbolDescription(type: string): string {
  switch (type) {
    case "COMMA":
      return "List separator.";
    case "SEMICOLON":
      return "Statement terminator.";
    case "LEFT_PAREN":
    case "RIGHT_PAREN":
      return "Grouping symbol.";
    default:
      return "SQL punctuation symbol.";
  }
}
