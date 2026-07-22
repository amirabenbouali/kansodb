import type { AutoSaveModeView } from "../../engine/KansoClient";
import type { UiPreferences } from "./uiPreferences";
import { Keyboard, LayoutPanelLeft, MonitorCog, RotateCcw, Save, TextCursorInput } from "lucide-react";
import type { ReactNode } from "react";

interface SettingsPanelProps {
  preferences: UiPreferences;
  onChange: (patch: Partial<UiPreferences>) => void;
  onReset: () => void;
}

export function SettingsPanel({ preferences, onChange, onReset }: SettingsPanelProps) {
  return (
    <section className="settings-page" aria-label="Settings">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Workbench</p>
          <h2>Settings</h2>
          <p>Local workbench preferences stored in this browser.</p>
        </div>
        <button type="button" onClick={onReset}>
          <RotateCcw size={14} aria-hidden="true" />
          Reset
        </button>
      </header>

      <div className="settings-grid">
        <section className="settings-card">
          <SettingsCardHeading icon={<MonitorCog size={15} aria-hidden="true" />} title="Appearance" description="Adjust visual tone and motion." />
          <div className="setting-row">
            <div>
              <strong>Theme</strong>
              <span>Choose the dark surface contrast.</span>
            </div>
            <SegmentedControl
              label="Theme"
              options={[
                { label: "Dark", value: "dark" },
                { label: "Dim", value: "dim" }
              ]}
              value={preferences.theme}
              onChange={(value) => onChange({ theme: value === "dim" ? "dim" : "dark" })}
            />
          </div>
          <ToggleRow
            checked={preferences.reducedMotion}
            label="Reduced motion"
            description="Minimise animated transitions and cursor motion."
            onChange={(checked) => onChange({ reducedMotion: checked })}
          />
        </section>

        <section className="settings-card">
          <SettingsCardHeading icon={<TextCursorInput size={15} aria-hidden="true" />} title="Editor" description="Tune SQL editing density." />
          <div className="setting-row">
            <div>
              <strong>Font size</strong>
              <span>{preferences.editorFontSize}px Monaco text.</span>
            </div>
            <input
              aria-label="Editor font size"
              className="compact-number-input"
              max={20}
              min={12}
              type="number"
              value={preferences.editorFontSize}
              onChange={(event) => onChange({ editorFontSize: Number(event.target.value) })}
            />
          </div>
          <ToggleRow
            checked={preferences.editorWordWrap}
            label="Word wrap"
            description="Wrap long SQL lines inside the editor viewport."
            onChange={(checked) => onChange({ editorWordWrap: checked })}
          />
        </section>

        <section className="settings-card">
          <SettingsCardHeading icon={<LayoutPanelLeft size={15} aria-hidden="true" />} title="Layout" description="Control persistent workbench panels." />
          <ToggleRow
            checked={preferences.rightPanelVisible}
            label="Right panel"
            description="Show schema and compact query history."
            onChange={(checked) => onChange({ rightPanelVisible: checked })}
          />
          <ToggleRow
            checked={preferences.sidebarCollapsed}
            label="Compact sidebar"
            description="Collapse navigation to icons."
            onChange={(checked) => onChange({ sidebarCollapsed: checked })}
          />
        </section>

        <section className="settings-card">
          <SettingsCardHeading icon={<Save size={15} aria-hidden="true" />} title="Persistence" description="Choose when file-backed data saves." />
          <div className="setting-row is-stacked">
            <div>
              <strong>Auto-save</strong>
              <span>Browser storage only remembers this preference.</span>
            </div>
            <SegmentedControl
              label="Auto-save mode"
              options={[
                { label: "Off", value: "off" },
                { label: "On commit", value: "on-commit" },
                { label: "After mutation", value: "after-mutation" }
              ]}
              value={preferences.autoSaveMode}
              onChange={(value) => onChange({ autoSaveMode: value as AutoSaveModeView })}
            />
          </div>
        </section>

        <section className="settings-card settings-card-wide">
          <SettingsCardHeading icon={<Keyboard size={15} aria-hidden="true" />} title="Keyboard" description="Shortcuts available inside the workbench." />
          <dl className="shortcut-list">
            <div><dt>Ctrl/Cmd + K</dt><dd>Command palette</dd></div>
            <div><dt>Ctrl/Cmd + Enter</dt><dd>Execute query</dd></div>
            <div><dt>Ctrl/Cmd + T</dt><dd>New query</dd></div>
            <div><dt>Ctrl/Cmd + W</dt><dd>Close query</dd></div>
            <div><dt>Ctrl/Cmd + S</dt><dd>Save current query</dd></div>
          </dl>
        </section>
      </div>
    </section>
  );
}

function SettingsCardHeading({ description, icon, title }: { description: string; icon: ReactNode; title: string }) {
  return (
    <div className="settings-card-heading">
      <span>{icon}</span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

function ToggleRow({
  checked,
  description,
  label,
  onChange
}: {
  checked: boolean;
  description: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="setting-row setting-toggle-row">
      <div>
        <strong>{label}</strong>
        <span>{description}</span>
      </div>
      <input checked={checked} type="checkbox" onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function SegmentedControl<TValue extends string>({
  label,
  onChange,
  options,
  value
}: {
  label: string;
  onChange: (value: TValue) => void;
  options: Array<{ label: string; value: TValue }>;
  value: TValue;
}) {
  return (
    <div className="segmented-control" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          className={option.value === value ? "is-selected" : undefined}
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
