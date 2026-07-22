import type { QueryTab } from "./queryTabTypes";

const STORAGE_KEY = "kansodb.queryTabs.v1";
const ACTIVE_TAB_KEY = "kansodb.activeQueryTab.v1";

export const INITIAL_SQL = `SELECT
  e.name,
  d.name AS department,
  e.salary
FROM employees e
LEFT JOIN departments d
  ON e.department_id = d.id
ORDER BY e.name ASC;`;

interface StoredTabs {
  activeTabId: string | null;
  tabs: QueryTab[];
}

export function createDefaultQueryTab(now = Date.now()): QueryTab {
  return {
    id: createQueryTabId(),
    title: "Query 1",
    sql: INITIAL_SQL,
    isDirty: false,
    createdAt: now,
    updatedAt: now,
    execution: null
  };
}

export function createQueryTabId(): string {
  if (globalThis.crypto?.randomUUID !== undefined) {
    return globalThis.crypto.randomUUID();
  }

  return `query-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function loadStoredQueryTabs(): StoredTabs {
  if (!canUseLocalStorage()) {
    const tab = createDefaultQueryTab();
    return { activeTabId: tab.id, tabs: [tab] };
  }

  try {
    const rawTabs = window.localStorage.getItem(STORAGE_KEY);
    const rawActiveTabId = window.localStorage.getItem(ACTIVE_TAB_KEY);
    const parsedTabs: unknown = rawTabs === null ? null : JSON.parse(rawTabs);

    if (!Array.isArray(parsedTabs)) {
      return defaultStoredTabs();
    }

    const tabs = parsedTabs.filter(isQueryTab);
    if (tabs.length === 0 || hasDuplicateIds(tabs)) {
      return defaultStoredTabs();
    }

    const activeTabId = rawActiveTabId !== null && tabs.some((tab) => tab.id === rawActiveTabId)
      ? rawActiveTabId
      : tabs[0]?.id ?? null;

    return { activeTabId, tabs };
  } catch {
    return defaultStoredTabs();
  }
}

export function saveStoredQueryTabs(tabs: QueryTab[], activeTabId: string | null): void {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs.map(stripRuntimeTabState)));

  if (activeTabId === null) {
    window.localStorage.removeItem(ACTIVE_TAB_KEY);
    return;
  }

  window.localStorage.setItem(ACTIVE_TAB_KEY, activeTabId);
}

function defaultStoredTabs(): StoredTabs {
  const tab = createDefaultQueryTab();
  return { activeTabId: tab.id, tabs: [tab] };
}

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && window.localStorage !== undefined;
}

function isQueryTab(value: unknown): value is QueryTab {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<QueryTab>;
  const isStoredTab = typeof candidate.id === "string"
    && typeof candidate.title === "string"
    && typeof candidate.sql === "string"
    && typeof candidate.isDirty === "boolean"
    && typeof candidate.createdAt === "number"
    && typeof candidate.updatedAt === "number";

  if (!isStoredTab) {
    return false;
  }

  candidate.execution = null;
  return true;
}

function hasDuplicateIds(tabs: QueryTab[]): boolean {
  return new Set(tabs.map((tab) => tab.id)).size !== tabs.length;
}

function stripRuntimeTabState(tab: QueryTab): QueryTab {
  return {
    id: tab.id,
    title: tab.title,
    sql: tab.sql,
    isDirty: tab.isDirty,
    createdAt: tab.createdAt,
    updatedAt: tab.updatedAt,
    execution: null
  };
}
