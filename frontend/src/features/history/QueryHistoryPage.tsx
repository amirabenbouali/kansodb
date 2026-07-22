import { Clipboard, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { EngineInspector } from "../engine-inspector/EngineInspector";
import { ErrorPanel } from "../errors/ErrorPanel";
import { ExecutionPanel } from "../execution/ExecutionPanel";
import { HistoryFilters } from "./HistoryFilters";
import type { HistoryFiltersState, QueryHistoryDetail, QueryHistoryEntry } from "./historyTypes";
import { QueryHistoryItem, historySummary } from "./QueryHistoryItem";

interface QueryHistoryPageProps {
  entries: readonly QueryHistoryEntry[];
  getHistoryDetail: (entryId: string) => QueryHistoryDetail | undefined;
  onClearHistory: () => void;
  onCopySql: (sql: string) => void;
  onRemoveEntry: (entryId: string) => void;
  onReopenSql: (sql: string) => void;
  onReplaceSql: (sql: string) => void;
}

const initialFilters: HistoryFiltersState = {
  search: "",
  status: "all",
  resultType: "all"
};

export function QueryHistoryPage({
  entries,
  getHistoryDetail,
  onClearHistory,
  onCopySql,
  onRemoveEntry,
  onReopenSql,
  onReplaceSql
}: QueryHistoryPageProps) {
  const [filters, setFilters] = useState<HistoryFiltersState>(initialFilters);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(entries[0]?.id ?? null);
  const filteredEntries = useMemo(() => filterEntries(entries, filters), [entries, filters]);
  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId) ?? filteredEntries[0] ?? null;
  const selectedDetail = selectedEntry === null ? undefined : getHistoryDetail(selectedEntry.id);

  return (
    <main className="workspace history-workspace">
      <section className="history-page">
        <header className="history-page-header">
          <div>
            <p className="eyebrow">History</p>
            <h2>Query History</h2>
          </div>
          <div>
            <button type="button" onClick={() => selectedEntry !== null ? onCopySql(selectedEntry.sql) : undefined}>
              <Clipboard size={15} aria-hidden="true" />
              Copy selected
            </button>
            <button type="button" onClick={onClearHistory}>
              <Trash2 size={15} aria-hidden="true" />
              Clear history
            </button>
          </div>
        </header>
        <HistoryFilters entries={entries} filters={filters} onFiltersChange={setFilters} />
        <div className="history-page-grid">
          <section className="history-list-panel" aria-label="Query history entries">
            {filteredEntries.length === 0 ? (
              <p className="history-empty">No history entries match these filters.</p>
            ) : filteredEntries.map((entry) => (
              <div className={entry.id === selectedEntry?.id ? "history-selectable is-selected" : "history-selectable"} key={entry.id}>
                <button type="button" aria-label="Select history entry" onClick={() => setSelectedEntryId(entry.id)} />
                <QueryHistoryItem
                  entry={entry}
                  onCopySql={onCopySql}
                  onInspect={setSelectedEntryId}
                  onRemove={onRemoveEntry}
                  onReopen={onReopenSql}
                  onReplace={onReplaceSql}
                />
              </div>
            ))}
          </section>
          <section className="history-detail-panel" aria-label="Selected history detail">
            {selectedEntry === null ? <p className="history-empty">Select a history entry to inspect it.</p> : (
              <>
                <div className="history-detail-heading">
                  <div>
                    <h3>{historySummary(selectedEntry)}</h3>
                    <span>{new Date(selectedEntry.executedAt).toLocaleString()}</span>
                  </div>
                  <code>{selectedEntry.sql}</code>
                </div>
                {selectedEntry.error === undefined ? null : <ErrorPanel error={selectedEntry.error} sourceSql={selectedEntry.sql} />}
                {selectedDetail === undefined ? (
                  <p className="history-empty">Only the summary is stored for this entry. Reopen the SQL to inspect a fresh result or trace.</p>
                ) : (
                  <>
                    <ExecutionPanel
                      running={false}
                      transactionActive={false}
                      snapshot={{
                        status: selectedEntry.status,
                        result: selectedDetail.result,
                        error: selectedDetail.error,
                        executionTimeMs: selectedEntry.durationMs ?? null,
                        executedSql: selectedDetail.executedSql,
                        trace: selectedDetail.trace
                      }}
                    />
                    <EngineInspector
                      error={selectedDetail.error}
                      trace={selectedDetail.trace}
                      onSelectSqlRange={() => undefined}
                    />
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

function filterEntries(entries: readonly QueryHistoryEntry[], filters: HistoryFiltersState): QueryHistoryEntry[] {
  const normalizedSearch = filters.search.trim().toLowerCase();

  return entries.filter((entry) => {
    const matchesSearch = normalizedSearch.length === 0 || entry.sql.toLowerCase().includes(normalizedSearch);
    const matchesStatus = filters.status === "all" || entry.status === filters.status;
    const matchesResult = filters.resultType === "all" || entry.resultType === filters.resultType;
    return matchesSearch && matchesStatus && matchesResult;
  });
}
