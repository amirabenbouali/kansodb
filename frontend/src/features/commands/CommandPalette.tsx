import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { filterCommands, type CommandAction } from "./commandTypes";

interface CommandPaletteProps {
  commands: readonly CommandAction[];
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ commands, open, onClose }: CommandPaletteProps) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const filteredCommands = useMemo(() => filterCommands(commands, search), [commands, search]);

  useEffect(() => {
    if (open) {
      setSearch("");
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="dialog-backdrop palette-backdrop" role="presentation">
      <section className="command-palette" role="dialog" aria-modal="true" aria-labelledby="command-palette-title">
        <h2 id="command-palette-title">Command Palette</h2>
        <label className="palette-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search commands</span>
          <input
            ref={inputRef}
            placeholder="Search commands..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                onClose();
              }
            }}
          />
        </label>
        <div className="palette-results" role="listbox" aria-label="Commands">
          {filteredCommands.length === 0 ? (
            <p>No commands match.</p>
          ) : filteredCommands.map((command) => (
            <button
              key={command.id}
              role="option"
              type="button"
              onClick={() => {
                command.run();
                onClose();
              }}
            >
              <span>
                <strong>{command.label}</strong>
                <em>{command.group}</em>
              </span>
              {command.shortcut === undefined ? null : <kbd>{command.shortcut}</kbd>}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
