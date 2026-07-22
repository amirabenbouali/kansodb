import { describe, expect, it } from "vitest";
import { executeSqlScript } from "../../src/execution/script-executor.js";
import { demoWorkspaceSql } from "../../src/examples/demo-workspace.js";
import { Database } from "../../src/storage/database.js";
import { exampleQueries } from "../../frontend/src/features/onboarding/sampleWorkspace.js";

describe("sample workspace", () => {
  it("includes portfolio workflow examples without unsupported SQL", () => {
    expect(exampleQueries.map((query) => query.id)).toEqual([
      "basic-select",
      "active-projects",
      "filter-high-salary",
      "filter-open-tasks",
      "sorting-budget",
      "aggregate-departments",
      "aggregate-task-load",
      "join-employee-departments",
      "join-project-clients",
      "insert-audit",
      "update-task",
      "delete-audit",
      "transaction-commit",
      "transaction-rollback",
      "foreign-key-error",
      "unique-error"
    ]);

    expect(exampleQueries.every((query) => query.sql.trim().endsWith(";"))).toBe(true);
  });

  it("builds a realistic relational demo database", () => {
    const database = createDemoDatabase();

    expect(database.listTables()).toEqual([
      "offices",
      "departments",
      "clients",
      "employees",
      "projects",
      "employee_projects",
      "project_assignments",
      "tasks",
      "salaries",
      "audit_log"
    ]);
    expect(database.getTable("departments").rowCount()).toBe(8);
    expect(database.getTable("employees").rowCount()).toBe(30);
    expect(database.getTable("clients").rowCount()).toBe(10);
    expect(database.getTable("projects").rowCount()).toBe(12);
    expect(database.getTable("tasks").rowCount()).toBe(60);
  });

  it("runs every non-error demo query against the bundled workspace", () => {
    for (const query of exampleQueries.filter((candidate) => !candidate.intentionalError)) {
      const database = createDemoDatabase();
      const result = executeSqlScript(database, query.sql);

      expect(result.failed, query.id).toBe(0);
      expect(result.succeeded, query.id).toBeGreaterThan(0);
    }
  });

  it("keeps constraint demos intentionally failing", () => {
    for (const query of exampleQueries.filter((candidate) => candidate.intentionalError)) {
      const database = createDemoDatabase();
      const result = executeSqlScript(database, query.sql);

      expect(result.failed, query.id).toBe(1);
    }
  });
});

function createDemoDatabase(): Database {
  const database = new Database();
  const result = executeSqlScript(database, demoWorkspaceSql, { atomic: true });

  expect(result.failed).toBe(0);
  return database;
}
