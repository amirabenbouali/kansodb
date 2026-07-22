import { Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import type { QueryTab } from "./queryTabTypes";
import { QueryTabItem } from "./QueryTabItem";

interface QueryTabsProps {
  activeTabId: string | null;
  closeConfirmation: QueryTab | null;
  onAddTab: () => void;
  onCancelClose: () => void;
  onCloseTab: (tab: QueryTab) => void;
  onConfirmClose: () => void;
  onRenameTab: (tabId: string, title: string) => void;
  onSelectTab: (tabId: string) => void;
  tabs: QueryTab[];
}

export function QueryTabs({
  activeTabId,
  closeConfirmation,
  onAddTab,
  onCancelClose,
  onCloseTab,
  onConfirmClose,
  onRenameTab,
  onSelectTab,
  tabs
}: QueryTabsProps) {
  return (
    <section className="workspace-tabs" aria-label="Query tabs">
      <div className="query-tab-list" role="tablist" aria-label="Open SQL queries">
        {tabs.map((tab) => (
          <QueryTabItem
            active={tab.id === activeTabId}
            key={tab.id}
            onActivate={() => onSelectTab(tab.id)}
            onClose={() => onCloseTab(tab)}
            onRename={(title) => onRenameTab(tab.id, title)}
            tab={tab}
          />
        ))}
      </div>
      <button className="add-tab" type="button" aria-label="Create new query tab" onClick={onAddTab}>
        <Plus size={18} aria-hidden="true" />
      </button>
      {closeConfirmation !== null ? (
        <CloseDirtyTabDialog
          tabTitle={closeConfirmation.title}
          onCancel={onCancelClose}
          onDiscard={onConfirmClose}
        />
      ) : null}
    </section>
  );
}

interface CloseDirtyTabDialogProps {
  onCancel: () => void;
  onDiscard: () => void;
  tabTitle: string;
}

function CloseDirtyTabDialog({ onCancel, onDiscard, tabTitle }: CloseDirtyTabDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const discardButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, []);

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onCancel();
        }
        if (event.key === "Tab") {
          const first = cancelButtonRef.current;
          const last = discardButtonRef.current;
          if (first === null || last === null) {
            return;
          }
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }}
    >
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="close-tab-title">
        <h2 id="close-tab-title">Discard unsaved query?</h2>
        <p>{tabTitle} has unsaved changes. You can cancel or discard the tab.</p>
        <div className="dialog-actions">
          <button ref={cancelButtonRef} type="button" onClick={onCancel}>
            Cancel
          </button>
          <button ref={discardButtonRef} className="danger-button" type="button" onClick={onDiscard}>
            Discard
          </button>
        </div>
      </section>
    </div>
  );
}
