interface StatusBarProps {
  databaseName: string;
  engineState: string;
  mode: string;
  version: string;
}

export function StatusBar({ databaseName, engineState, mode, version }: StatusBarProps) {
  return (
    <footer className="status-bar">
      <span>
        Database: {databaseName}
        <i className="mode-dot" aria-hidden="true" />
      </span>
      <span>
        Engine: {engineState}
        <i className="mode-dot" aria-hidden="true" />
      </span>
      <span>Version: {version}</span>
      <span>{mode}</span>
    </footer>
  );
}
