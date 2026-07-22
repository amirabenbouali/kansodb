export interface CommandAction {
  id: string;
  label: string;
  group: string;
  shortcut?: string;
  run: () => void;
}

export function filterCommands(commands: readonly CommandAction[], search: string): CommandAction[] {
  const query = search.trim().toLowerCase();
  if (query.length === 0) {
    return [...commands];
  }

  return commands.filter((command) => {
    const haystack = `${command.label} ${command.group} ${command.shortcut ?? ""}`.toLowerCase();
    return haystack.includes(query);
  });
}
