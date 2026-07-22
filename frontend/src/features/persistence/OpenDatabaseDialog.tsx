import { useEffect, useRef, useState } from "react";

interface OpenDatabaseDialogProps {
  knownDatabases: string[];
  open: boolean;
  onCancel: () => void;
  onCreateFile: (name: string) => void;
  onCreateMemory: () => void;
  onOpen: (name: string) => void;
}

export function OpenDatabaseDialog({
  knownDatabases,
  open,
  onCancel,
  onCreateFile,
  onCreateMemory,
  onOpen
}: OpenDatabaseDialogProps) {
  const [name, setName] = useState("workspace.db.json");
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      nameRef.current?.focus();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog-card database-dialog" role="dialog" aria-modal="true" aria-labelledby="database-dialog-title">
        <h2 id="database-dialog-title">Database</h2>
        <p>Use a browser-backed database file, or switch to an in-memory database for scratch work.</p>
        <label className="field-label">
          File name
          <input ref={nameRef} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="known-databases" aria-label="Known browser databases">
          {knownDatabases.map((database) => (
            <button key={database} type="button" onClick={() => onOpen(database)}>{database}</button>
          ))}
        </div>
        <div className="dialog-actions">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="button" onClick={onCreateMemory}>New memory DB</button>
          <button className="primary-button" type="button" onClick={() => onCreateFile(name)}>New/open file</button>
        </div>
      </section>
    </div>
  );
}
