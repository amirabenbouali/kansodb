import { Plus } from "lucide-react";

interface EmptyEditorProps {
  onNewQuery: () => void;
}

export function EmptyEditor({ onNewQuery }: EmptyEditorProps) {
  return (
    <section className="empty-editor" aria-label="No open query tabs">
      <h2>No query tabs open</h2>
      <p>Create a new SQL query tab to start drafting.</p>
      <button type="button" onClick={onNewQuery}>
        <Plus size={16} aria-hidden="true" />
        New query
      </button>
    </section>
  );
}
