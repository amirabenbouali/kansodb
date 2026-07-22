import { Redo2, Save, Undo2 } from "lucide-react";
import { ExecuteButton } from "../execution/ExecuteButton";

interface EditorToolbarProps {
  canExecute: boolean;
  executionRunning: boolean;
  onCancelExecutionDisplay: () => void;
  onExecute: () => void;
  onSave: () => void;
}

export function EditorToolbar({
  canExecute,
  executionRunning,
  onCancelExecutionDisplay,
  onExecute,
  onSave
}: EditorToolbarProps) {
  return (
    <div className="workspace-actions" aria-label="Editor actions">
      <button
        className="toolbar-button"
        type="button"
        aria-label="Undo"
        title="Undo"
        data-editor-command="undo"
      >
        <Undo2 size={16} aria-hidden="true" />
      </button>
      <button
        className="toolbar-button"
        type="button"
        aria-label="Redo"
        title="Redo"
        data-editor-command="redo"
      >
        <Redo2 size={16} aria-hidden="true" />
      </button>
      <button className="toolbar-button" type="button" aria-label="Save query" title="Save query" onClick={onSave}>
        <Save size={16} aria-hidden="true" />
      </button>
      <ExecuteButton
        canExecute={canExecute}
        running={executionRunning}
        onCancelDisplay={onCancelExecutionDisplay}
        onExecute={onExecute}
      />
    </div>
  );
}
