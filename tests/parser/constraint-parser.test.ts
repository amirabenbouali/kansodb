import { describe, expect, it } from "vitest";
import { Parser, ParserError, tokenize } from "../../src/index.js";

function parseCreateTable(sql: string) {
  return new Parser(tokenize(sql)).parseCreateTableStatement();
}

describe("constraint parser", () => {
  it("parses column-level primary key, unique, not null, and references", () => {
    expect(parseCreateTable("CREATE TABLE employees (id INTEGER PRIMARY KEY, email TEXT UNIQUE, name TEXT NOT NULL, department_id INTEGER REFERENCES departments(id))")).toMatchObject({
      columns: [
        { name: "id", dataType: "INTEGER", nullable: false, unique: true, primaryKey: true },
        { name: "email", dataType: "TEXT", nullable: false, unique: true, primaryKey: false },
        { name: "name", dataType: "TEXT", nullable: false, unique: false, primaryKey: false },
        {
          name: "department_id",
          dataType: "INTEGER",
          nullable: false,
          unique: false,
          primaryKey: false,
          references: { tableName: "departments", columnName: "id" }
        }
      ]
    });
  });

  it("parses multiple column constraints in varying order", () => {
    expect(parseCreateTable("CREATE TABLE users (email TEXT UNIQUE NOT NULL)")).toMatchObject({
      columns: [{ name: "email", nullable: false, unique: true, primaryKey: false }]
    });
  });

  it("parses table-level primary and foreign key constraints", () => {
    expect(parseCreateTable("CREATE TABLE employees (id INTEGER, department_id INTEGER, PRIMARY KEY (id), FOREIGN KEY (department_id) REFERENCES departments(id))")).toMatchObject({
      columns: [
        { name: "id", dataType: "INTEGER" },
        { name: "department_id", dataType: "INTEGER" }
      ],
      constraints: [
        { type: "primary_key", columnName: "id" },
        { type: "foreign_key", columnName: "department_id", references: { tableName: "departments", columnName: "id" } }
      ]
    });
  });

  it("rejects incomplete column constraints", () => {
    expect(() => parseCreateTable("CREATE TABLE t (id INTEGER PRIMARY)")).toThrow(ParserError);
    expect(() => parseCreateTable("CREATE TABLE t (id INTEGER KEY)")).toThrow(ParserError);
    expect(() => parseCreateTable("CREATE TABLE t (name TEXT NOT)")).toThrow(ParserError);
    expect(() => parseCreateTable("CREATE TABLE t (department_id INTEGER REFERENCES departments)")).toThrow(ParserError);
  });

  it("rejects duplicate and contradictory column constraints", () => {
    expect(() => parseCreateTable("CREATE TABLE t (id INTEGER PRIMARY KEY PRIMARY KEY)")).toThrow(ParserError);
    expect(() => parseCreateTable("CREATE TABLE t (email TEXT UNIQUE UNIQUE)")).toThrow(ParserError);
    expect(() => parseCreateTable("CREATE TABLE t (name TEXT NOT NULL NULL)")).toThrow(ParserError);
    expect(() => parseCreateTable("CREATE TABLE t (id INTEGER PRIMARY KEY NULL)")).toThrow(ParserError);
  });

  it("rejects named constraints and composite keys", () => {
    expect(() => parseCreateTable("CREATE TABLE t (id INTEGER, CONSTRAINT pk PRIMARY KEY (id))")).toThrow(ParserError);
    expect(() => parseCreateTable("CREATE TABLE t (id INTEGER, tenant_id INTEGER, PRIMARY KEY (id, tenant_id))")).toThrow(ParserError);
    expect(() => parseCreateTable("CREATE TABLE t (department_id INTEGER, location_id INTEGER, FOREIGN KEY (department_id, location_id) REFERENCES departments(id))")).toThrow(ParserError);
    expect(() => parseCreateTable("CREATE TABLE t (department_id INTEGER, FOREIGN KEY (department_id) REFERENCES departments(id, location_id))")).toThrow(ParserError);
  });
});
