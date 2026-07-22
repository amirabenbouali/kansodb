import { describe, expect, it } from "vitest";
import { sqlAnd, sqlNot, sqlOr, type TruthValue } from "../../src/index.js";

const values: TruthValue[] = ["TRUE", "FALSE", "UNKNOWN"];

describe("SQL truth values", () => {
  it("evaluates AND truth table", () => {
    const expected: Record<string, TruthValue> = {
      "TRUE,TRUE": "TRUE",
      "TRUE,FALSE": "FALSE",
      "TRUE,UNKNOWN": "UNKNOWN",
      "FALSE,TRUE": "FALSE",
      "FALSE,FALSE": "FALSE",
      "FALSE,UNKNOWN": "FALSE",
      "UNKNOWN,TRUE": "UNKNOWN",
      "UNKNOWN,FALSE": "FALSE",
      "UNKNOWN,UNKNOWN": "UNKNOWN"
    };

    for (const left of values) {
      for (const right of values) {
        expect(sqlAnd(left, right)).toBe(expected[`${left},${right}`]);
      }
    }
  });

  it("evaluates OR truth table", () => {
    const expected: Record<string, TruthValue> = {
      "TRUE,TRUE": "TRUE",
      "TRUE,FALSE": "TRUE",
      "TRUE,UNKNOWN": "TRUE",
      "FALSE,TRUE": "TRUE",
      "FALSE,FALSE": "FALSE",
      "FALSE,UNKNOWN": "UNKNOWN",
      "UNKNOWN,TRUE": "TRUE",
      "UNKNOWN,FALSE": "UNKNOWN",
      "UNKNOWN,UNKNOWN": "UNKNOWN"
    };

    for (const left of values) {
      for (const right of values) {
        expect(sqlOr(left, right)).toBe(expected[`${left},${right}`]);
      }
    }
  });

  it("evaluates NOT truth table", () => {
    expect(sqlNot("TRUE")).toBe("FALSE");
    expect(sqlNot("FALSE")).toBe("TRUE");
    expect(sqlNot("UNKNOWN")).toBe("UNKNOWN");
  });
});
