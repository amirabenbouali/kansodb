import type { AutoSaveModeView } from "../../engine/KansoClient";

interface AutoSaveSettingsProps {
  disabled: boolean;
  mode: AutoSaveModeView;
  onChange: (mode: AutoSaveModeView) => void;
}

const modes: Array<{ value: AutoSaveModeView; label: string; description: string }> = [
  { value: "off", label: "Off", description: "Manual SAVE only." },
  { value: "on-commit", label: "On commit", description: "Save after COMMIT succeeds." },
  { value: "after-mutation", label: "After mutation", description: "Save after mutations and commits." }
];

export function AutoSaveSettings({ disabled, mode, onChange }: AutoSaveSettingsProps) {
  return (
    <fieldset className="auto-save-settings" disabled={disabled}>
      <legend>Auto-save</legend>
      {modes.map((option) => (
        <label key={option.value}>
          <input
            checked={mode === option.value}
            name="auto-save-mode"
            type="radio"
            value={option.value}
            onChange={() => onChange(option.value)}
          />
          <span>
            <strong>{option.label}</strong>
            <em>{option.description}</em>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
