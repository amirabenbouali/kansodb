export type TruthValue = "TRUE" | "FALSE" | "UNKNOWN";

export function sqlAnd(left: TruthValue, right: TruthValue): TruthValue {
  if (left === "FALSE" || right === "FALSE") return "FALSE";
  if (left === "UNKNOWN" || right === "UNKNOWN") return "UNKNOWN";
  return "TRUE";
}

export function sqlOr(left: TruthValue, right: TruthValue): TruthValue {
  if (left === "TRUE" || right === "TRUE") return "TRUE";
  if (left === "UNKNOWN" || right === "UNKNOWN") return "UNKNOWN";
  return "FALSE";
}

export function sqlNot(value: TruthValue): TruthValue {
  switch (value) {
    case "TRUE":
      return "FALSE";
    case "FALSE":
      return "TRUE";
    case "UNKNOWN":
      return "UNKNOWN";
  }
}

export function truthValueFromBoolean(value: boolean): TruthValue {
  return value ? "TRUE" : "FALSE";
}

export function passesPredicate(value: TruthValue): boolean {
  return value === "TRUE";
}
