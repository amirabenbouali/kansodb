import { useCallback, useEffect, useMemo, useState } from "react";
import { clearStoredQueryHistory, loadStoredQueryHistory, MAX_HISTORY_ENTRIES, saveStoredQueryHistory } from "./historyStorage";
import type { QueryHistoryDetail, QueryHistoryEntry, QueryHistoryRecord } from "./historyTypes";

interface UseQueryHistoryResult {
  addHistoryRecord: (entry: QueryHistoryEntry, detail?: QueryHistoryDetail) => void;
  clearHistory: () => void;
  entries: QueryHistoryEntry[];
  getHistoryDetail: (entryId: string) => QueryHistoryDetail | undefined;
  records: QueryHistoryRecord[];
  removeHistoryEntry: (entryId: string) => void;
}

export function useQueryHistory(): UseQueryHistoryResult {
  const [entries, setEntries] = useState<QueryHistoryEntry[]>(loadStoredQueryHistory);
  const [detailsById, setDetailsById] = useState<ReadonlyMap<string, QueryHistoryDetail>>(() => new Map());

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      saveStoredQueryHistory(entries);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [entries]);

  const addHistoryRecord = useCallback((entry: QueryHistoryEntry, detail?: QueryHistoryDetail) => {
    setEntries((currentEntries) => [entry, ...currentEntries.filter((candidate) => candidate.id !== entry.id)].slice(0, MAX_HISTORY_ENTRIES));

    if (detail !== undefined) {
      setDetailsById((currentDetails) => {
        const nextDetails = new Map(currentDetails);
        nextDetails.set(entry.id, detail);
        trimDetails(nextDetails, [entry.id, ...entries.map((candidate) => candidate.id)].slice(0, MAX_HISTORY_ENTRIES));
        return nextDetails;
      });
    }
  }, [entries]);

  const removeHistoryEntry = useCallback((entryId: string) => {
    setEntries((currentEntries) => currentEntries.filter((entry) => entry.id !== entryId));
    setDetailsById((currentDetails) => {
      const nextDetails = new Map(currentDetails);
      nextDetails.delete(entryId);
      return nextDetails;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setEntries([]);
    setDetailsById(new Map());
    clearStoredQueryHistory();
  }, []);

  const getHistoryDetail = useCallback(
    (entryId: string) => detailsById.get(entryId),
    [detailsById]
  );

  const records = useMemo(
    () => entries.map((entry) => ({
      entry,
      ...(detailsById.has(entry.id) ? { detail: detailsById.get(entry.id)! } : {})
    })),
    [detailsById, entries]
  );

  return {
    addHistoryRecord,
    clearHistory,
    entries,
    getHistoryDetail,
    records,
    removeHistoryEntry
  };
}

function trimDetails(details: Map<string, QueryHistoryDetail>, retainedIds: readonly string[]): void {
  const retained = new Set(retainedIds);

  for (const id of details.keys()) {
    if (!retained.has(id)) {
      details.delete(id);
    }
  }
}
