export type StatementMode = "empty" | "single" | "script";

export function detectStatementMode(sql: string): StatementMode {
  let inString = false;
  let hasStatementText = false;
  let completedStatements = 0;

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];

    if (character === "'") {
      if (inString && sql[index + 1] === "'") {
        index += 1;
      } else {
        inString = !inString;
      }
      hasStatementText = true;
      continue;
    }

    if (inString) {
      hasStatementText = true;
      continue;
    }

    if (character === ";") {
      if (hasStatementText) {
        completedStatements += 1;
        hasStatementText = false;
      }
      continue;
    }

    if (!isWhitespace(character)) {
      hasStatementText = true;
    }
  }

  const totalStatements = completedStatements + (hasStatementText ? 1 : 0);
  if (totalStatements === 0) {
    return "empty";
  }

  return totalStatements === 1 ? "single" : "script";
}

function isWhitespace(value: string | undefined): boolean {
  return value === " " || value === "\n" || value === "\r" || value === "\t" || value === "\f";
}
