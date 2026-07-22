import { Play, X } from "lucide-react";

interface ExecuteButtonProps {
  canExecute: boolean;
  running: boolean;
  onCancelDisplay: () => void;
  onExecute: () => void;
}

export function ExecuteButton({ canExecute, running, onCancelDisplay, onExecute }: ExecuteButtonProps) {
  if (running) {
    return (
      <button className="execute-placeholder" type="button" onClick={onCancelDisplay}>
        <X size={16} aria-hidden="true" />
        Dismiss
      </button>
    );
  }

  return (
    <button
      className="execute-placeholder"
      type="button"
      disabled={!canExecute}
      aria-busy={running}
      onClick={onExecute}
    >
      <Play size={16} aria-hidden="true" />
      Execute
    </button>
  );
}
