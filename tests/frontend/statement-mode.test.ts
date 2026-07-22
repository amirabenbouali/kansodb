import { describe, expect, it } from "vitest";
import { detectStatementMode } from "../../frontend/src/engine/statementMode.js";

describe("statement mode detection", () => {
  it("ignores semicolons inside SQL strings", () => {
    expect(detectStatementMode("SELECT 'hello; world';")).toBe("single");
  });

  it("detects scripts without naive splitting", () => {
    expect(detectStatementMode("SELECT 'one;'; SELECT 2;")).toBe("script");
  });
});
