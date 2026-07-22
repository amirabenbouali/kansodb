import { Check, Moon, X } from "lucide-react";
import { mockHistory } from "../../data/mockHistory";
import { SchemaExplorer } from "../../features/schema/SchemaExplorer";
import type { SchemaProvider } from "../../features/schema/schemaProvider";

interface RightPanelProps {
  onInsertSql: (sql: string) => void;
  schemaProvider: SchemaProvider;
  schemaRefreshToken: number;
  visible: boolean;
}

export function RightPanel({ onInsertSql, schemaProvider, schemaRefreshToken, visible }: RightPanelProps) {
  return (
    <aside className={visible ? "right-panel" : "right-panel is-hidden"} aria-label="Database context">
      <div className="right-toolbar">
        <Moon size={18} aria-hidden="true" />
      </div>

      <div className="right-content">
        <SchemaExplorer onInsertSql={onInsertSql} provider={schemaProvider} refreshToken={schemaRefreshToken} />

        <section className="right-section">
          <h2>Query History</h2>
          <div className="history-stack">
            {mockHistory.map((item) => (
              <article className={`history-card is-${item.status}`} key={item.id}>
                <span className="history-status" aria-hidden="true">
                  {item.status === "success" ? <Check size={14} /> : <X size={14} />}
                </span>
                <div>
                  <code>{item.statement}</code>
                  <span>{item.duration}</span>
                </div>
                <strong>{item.outcome}</strong>
              </article>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}
