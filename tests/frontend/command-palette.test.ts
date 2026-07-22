import { describe, expect, it } from "vitest";
import { filterCommands, type CommandAction } from "../../frontend/src/features/commands/commandTypes.js";

const noop = () => undefined;

const commands: CommandAction[] = [
  { id: "new-query", label: "New query", group: "Editor", shortcut: "Ctrl/Cmd T", run: noop },
  { id: "save-database", label: "Save database", group: "Database", run: noop },
  { id: "rollback", label: "Rollback transaction", group: "Transaction", run: noop }
];

describe("command filtering", () => {
  it("returns all commands for an empty search", () => {
    expect(filterCommands(commands, "")).toHaveLength(3);
  });

  it("searches labels, groups, and shortcuts case-insensitively", () => {
    expect(filterCommands(commands, "database").map((command) => command.id)).toEqual(["save-database"]);
    expect(filterCommands(commands, "CTRL/CMD T").map((command) => command.id)).toEqual(["new-query"]);
    expect(filterCommands(commands, "trans").map((command) => command.id)).toEqual(["rollback"]);
  });
});
