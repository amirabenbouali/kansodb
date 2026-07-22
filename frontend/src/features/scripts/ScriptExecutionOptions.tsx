interface ScriptExecutionOptionsProps {
  atomic: boolean;
  stopOnError: boolean;
  onAtomicChange: (value: boolean) => void;
  onStopOnErrorChange: (value: boolean) => void;
}

export function ScriptExecutionOptions({
  atomic,
  stopOnError,
  onAtomicChange,
  onStopOnErrorChange
}: ScriptExecutionOptionsProps) {
  return (
    <section className="script-options" aria-label="Script execution options">
      <label>
        <input type="checkbox" checked={atomic} onChange={(event) => onAtomicChange(event.target.checked)} />
        <span>Atomic script</span>
      </label>
      <label>
        <input type="checkbox" checked={stopOnError} onChange={(event) => onStopOnErrorChange(event.target.checked)} />
        <span>Stop on error</span>
      </label>
    </section>
  );
}
