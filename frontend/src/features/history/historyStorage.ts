import type { QueryHistoryEntry } from "./historyTypes";

const HISTORY_STORAGE_KEY = "kansodb.queryHistory.v1";
export const MAX_HISTORY_ENTRIES = 200;

export function loadStoredQueryHistory(): QueryHistoryEntry[] {
  if (!canUseLocalStorage()) {
    return [];
  }

  try {
    const rawHistory = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    const parsedHistory: unknown = rawHistory === null ? [] : JSON.parse(rawHistory);

    if (!Array.isArray(parsedHistory)) {
      return [];
    }

    return parsedHistory
      .filter(isQueryHistoryEntry)
      .slice(0, MAX_HISTORY_ENTRIES);
  } catch {
    return [];
  }
}

export function saveStoredQueryHistory(entries: readonly QueryHistoryEntry[]): void {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY_ENTRIES)));
}

export function clearStoredQueryHistory(): void {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(HISTORY_STORAGE_KEY);
}

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && window.localStorage !== undefined;
}

function isQueryHistoryEntry(value: unknown): value is QueryHistoryEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<QueryHistoryEntry>;
  return typeof candidate.id === "string"
    && typeof candidate.sql === "string"
    && typeof candidate.executedAt === "number"
    && (candidate.status === "success" || candidate.status === "error")
    && (candidate.tabId === undefined || typeof candidate.tabId === "string")
    && (candidate.durationMs === undefined || typeof candidate.durationMs === "number")
    && (candidate.resultType === undefined || typeof candidate.resultType === "string")
    && (candidate.rowCount === undefined || typeof candidate.rowCount === "number")
    && (candidate.affectedRows === undefined || typeof candidate.affectedRows === "number")
    && (candidate.transactionState === undefined || candidate.transactionState === "IDLE" || candidate.transactionState === "ACTIVE")
    && (candidate.error === undefined || isStoredError(candidate.error));
}

function isStoredError(value: unknown): boolean {
  return typeof value === "object"
    && value !== null
    && "code" in value
    && typeof value.code === "string"
    && "message" in value
    && typeof value.message === "string";
}
