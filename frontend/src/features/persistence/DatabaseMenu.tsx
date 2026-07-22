import { Database, FolderOpen, Plus } from "lucide-react";
import type { PersistenceStateView } from "../../engine/KansoClient";

interface DatabaseMenuProps {
  persistence: PersistenceStateView;
  onCreateFile: () => void;
  onCreateMemory: () => void;
  onOpen: () => void;
}

export function DatabaseMenu({ persistence, onCreateFile, onCreateMemory, onOpen }: DatabaseMenuProps) {
  return (
    <section className="database-menu" aria-label="Database menu">
      <button type="button" onClick={onOpen}>
        <FolderOpen size={14} aria-hidden="true" />
        Open
      </button>
      <button type="button" onClick={onCreateMemory}>
        <Database size={14} aria-hidden="true" />
        New memory
      </button>
      <button type="button" onClick={onCreateFile}>
        <Plus size={14} aria-hidden="true" />
        File-backed
      </button>
      <span>{persistence.capabilities.importExportFallback ? "Import/export fallback available" : "Import/export unavailable"}</span>
    </section>
  );
}
