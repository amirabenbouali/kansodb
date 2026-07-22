import { demoQueries, demoWorkspaceDescription, type DemoQuery } from "../../../../src/examples/demo-workspace.js";

export type ExampleQuery = DemoQuery;

export const exampleQueries: ExampleQuery[] = demoQueries;
export const exampleDatabaseDescription = demoWorkspaceDescription;
