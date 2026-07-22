import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { QueryTab } from "./queryTabTypes";

interface QueryTabItemProps {
  active: boolean;
  onActivate: () => void;
  onClose: () => void;
  onRename: (title: string) => void;
  tab: QueryTab;
}

export function QueryTabItem({ active, onActivate, onClose, onRename, tab }: QueryTabItemProps) {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(tab.title);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraftTitle(tab.title);
  }, [tab.title]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commitRename = () => {
    onRename(draftTitle);
    setEditing(false);
  };

  return (
    <div className={active ? "query-tab is-active" : "query-tab"} role="presentation">
      <button
        className="query-tab-button"
        type="button"
        role="tab"
        aria-selected={active}
        aria-label={`${tab.title}${tab.isDirty ? ", unsaved changes" : ""}`}
        onClick={onActivate}
        onDoubleClick={() => setEditing(true)}
      >
        <span className={tab.isDirty ? "dirty-dot is-visible" : "dirty-dot"} aria-hidden="true" />
        {editing ? (
          <input
            ref={inputRef}
            className="query-tab-input"
            value={draftTitle}
            aria-label="Rename query tab"
            onChange={(event) => setDraftTitle(event.target.value)}
            onBlur={commitRename}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                commitRename();
              }
              if (event.key === "Escape") {
                setDraftTitle(tab.title);
                setEditing(false);
              }
            }}
          />
        ) : (
          <span className="query-tab-title">{tab.title}</span>
        )}
      </button>
      <button className="query-tab-close" type="button" aria-label={`Close ${tab.title}`} onClick={onClose}>
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
