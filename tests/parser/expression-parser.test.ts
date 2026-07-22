import { describe, expect, it } from "vitest";
import { Parser, ParserError, tokenize } from "../../src/index.js";

function parseSelect(sql: string) {
  return new Parser(tokenize(sql)).parseSelectStatement();
}

function firstExpression(sql: string) {
  const first = parseSelect(sql).columns[0];
  if (first?.type !== "select_expression") {
    throw new Error("Expected select expression");
  }
  return first.expression;
}

describe("expression parser", () => {
  it("parses arithmetic precedence and associativity", () => {
    expect(firstExpression("SELECT 1 + 2 * 3 FROM numbers")).toEqual({
      type: "arithmetic",
      operator: "+",
      left: { type: "literal", value: 1 },
      right: {
        type: "arithmetic",
        operator: "*",
        left: { type: "literal", value: 2 },
        right: { type: "literal", value: 3 }
      }
    });

    expect(firstExpression("SELECT 1 - 2 - 3 FROM numbers")).toMatchObject({
      type: "arithmetic",
      operator: "-",
      left: { type: "arithmetic", operator: "-" }
    });
  });

  it("parses unary operators and parentheses", () => {
    expect(firstExpression("SELECT -(salary + 1000) FROM employees")).toMatchObject({
      type: "unary",
      operator: "-",
      operand: { type: "arithmetic", operator: "+" }
    });
  });

  it("parses arithmetic in WHERE", () => {
    expect(parseSelect("SELECT name FROM employees WHERE salary + bonus >= 50000 AND active = TRUE").where).toMatchObject({
      type: "logical",
      operator: "AND",
      left: {
        type: "comparison",
        left: { type: "arithmetic", operator: "+" }
      }
    });
  });

  it("parses result aliases only with AS", () => {
    expect(parseSelect("SELECT salary * 1.1 AS adjusted_salary FROM employees").columns[0]).toMatchObject({
      type: "select_expression",
      alias: "adjusted_salary",
      expression: { type: "arithmetic", operator: "*" }
    });

    expect(() => parseSelect("SELECT salary * 1.1 adjusted_salary FROM employees")).toThrow(ParserError);
  });

  it("parses richer ORDER BY items", () => {
    expect(parseSelect("SELECT department, COUNT(*) AS total FROM employees GROUP BY department ORDER BY total DESC, 2 ASC").orderBy).toEqual({
      items: [
        { expression: { type: "result_alias", name: "total" }, direction: "DESC" },
        { expression: { type: "ordinal", position: 2 }, direction: "ASC" }
      ]
    });
  });

  it("rejects invalid ORDER BY positions and trailing commas", () => {
    expect(() => parseSelect("SELECT name FROM employees ORDER BY 0")).toThrow(ParserError);
    expect(() => parseSelect("SELECT name FROM employees ORDER BY -1")).toThrow(ParserError);
    expect(() => parseSelect("SELECT name FROM employees ORDER BY name,")).toThrow(ParserError);
  });

  it("parses arithmetic UPDATE assignments", () => {
    expect(new Parser(tokenize("UPDATE employees SET salary = salary + 2500 WHERE department_id = 1")).parse()).toMatchObject({
      type: "update",
      assignments: [
        {
          columnName: "salary",
          value: { type: "arithmetic", operator: "+" }
        }
      ],
      where: { type: "comparison" }
    });
  });

  it("parses LEFT JOIN variants", () => {
    expect(parseSelect("SELECT e.name FROM employees e LEFT JOIN departments d ON e.department_id = d.id")).toMatchObject({
      joins: [{ type: "join", joinType: "LEFT", table: { name: "departments", alias: "d" } }]
    });
    expect(parseSelect("SELECT e.name FROM employees AS e left join departments AS d ON e.department_id = d.id")).toMatchObject({
      joins: [{ joinType: "LEFT", table: { alias: "d" } }]
    });
  });

  it("rejects invalid LEFT JOIN syntax", () => {
    expect(() => parseSelect("SELECT e.name FROM employees e LEFT departments d ON e.department_id = d.id")).toThrow(ParserError);
    expect(() => parseSelect("SELECT e.name FROM employees e LEFT OUTER JOIN departments d ON e.department_id = d.id")).toThrow(ParserError);
  });

  it("parses null predicates", () => {
    expect(parseSelect("SELECT name FROM employees WHERE department_id IS NULL").where).toEqual({
      type: "null_check",
      operand: { type: "column", name: "department_id" },
      negated: false
    });
    expect(parseSelect("SELECT name FROM employees WHERE bonus IS NOT NULL").where).toEqual({
      type: "null_check",
      operand: { type: "column", name: "bonus" },
      negated: true
    });
    expect(parseSelect("SELECT name FROM employees WHERE salary + bonus IS NULL OR active = TRUE").where).toMatchObject({
      type: "logical",
      left: { type: "null_check", operand: { type: "arithmetic" } }
    });
  });

  it("rejects invalid null predicates", () => {
    expect(() => parseSelect("SELECT name FROM employees WHERE department_id IS")).toThrow(ParserError);
    expect(() => parseSelect("SELECT name FROM employees WHERE department_id IS NOT")).toThrow(ParserError);
    expect(() => parseSelect("SELECT name FROM employees WHERE department_id IS TRUE")).toThrow(ParserError);
    expect(() => parseSelect("SELECT name FROM employees WHERE department_id IS NULL IS NULL")).toThrow(ParserError);
  });

  it("parses explicit null ordering", () => {
    expect(parseSelect("SELECT name FROM employees ORDER BY salary DESC NULLS LAST, name ASC NULLS FIRST").orderBy).toEqual({
      items: [
        { expression: { type: "result_alias", name: "salary" }, direction: "DESC", nulls: "LAST" },
        { expression: { type: "result_alias", name: "name" }, direction: "ASC", nulls: "FIRST" }
      ]
    });
  });

  it("rejects invalid null ordering", () => {
    expect(() => parseSelect("SELECT name FROM employees ORDER BY salary NULLS")).toThrow(ParserError);
    expect(() => parseSelect("SELECT name FROM employees ORDER BY salary NULLS MIDDLE")).toThrow(ParserError);
    expect(() => parseSelect("SELECT name FROM employees ORDER BY salary NULLS LAST DESC")).toThrow(ParserError);
  });
});
