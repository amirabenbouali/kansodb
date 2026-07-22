import { describe, expect, it } from "vitest";
import { analyseExpression } from "../../src/index.js";

describe("analyseExpression", () => {
  it("classifies null checks as non-nullable predicates", () => {
    expect(analyseExpression({
      type: "null_check",
      operand: { type: "column", name: "bonus" },
      negated: false
    })).toEqual({
      dataType: "BOOLEAN",
      nullable: false,
      category: "predicate"
    });
  });

  it("classifies comparisons as nullable predicates", () => {
    expect(analyseExpression({
      type: "comparison",
      operator: "=",
      left: { type: "column", name: "bonus" },
      right: { type: "literal", value: null }
    })).toEqual({
      dataType: "BOOLEAN",
      nullable: true,
      category: "predicate"
    });
  });
});
