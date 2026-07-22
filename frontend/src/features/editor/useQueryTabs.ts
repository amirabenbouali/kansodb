import { useCallback, useEffect, useMemo, useState } from "react";
import type { QueryTabExecutionSnapshot } from "../execution/executionTypes";
import type { QueryTab } from "./queryTabTypes";
import {
  createDefaultQueryTab,
  createQueryTabId,
  loadStoredQueryTabs,
  saveStoredQueryTabs
} from "./queryTabStorage";

interface UseQueryTabsResult {
  activeTab: QueryTab | null;
  activeTabId: string | null;
  addTab: () => QueryTab;
  closeTab: (tabId: string) => void;
  getTab: (tabId: string) => QueryTab | undefined;
  renameTab: (tabId: string, title: string) => void;
  saveTab: (tabId: string) => void;
  setActiveTabId: (tabId: string) => void;
  tabs: QueryTab[];
  updateTabExecution: (tabId: string, execution: QueryTabExecutionSnapshot | null) => void;
  updateTabSql: (tabId: string, sql: string) => void;
}

export function useQueryTabs(): UseQueryTabsResult {
  const [initialState] = useState(loadStoredQueryTabs);
  const [tabs, setTabs] = useState<QueryTab[]>(initialState.tabs);
  const [activeTabId, setActiveTabIdState] = useState<string | null>(initialState.activeTabId);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      saveStoredQueryTabs(tabs, activeTabId);
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeTabId, tabs]);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? null,
    [activeTabId, tabs]
  );

  const setActiveTabId = useCallback((tabId: string) => {
    setActiveTabIdState(tabId);
  }, []);

  const addTab = useCallback(() => {
    const now = Date.now();
    const newTab: QueryTab = {
      ...createDefaultQueryTab(now),
      id: createUniqueTabId(tabs),
      title: nextQueryTitle(tabs),
      sql: "",
      isDirty: false,
      execution: null
    };

    setTabs((currentTabs) => [...currentTabs, newTab]);
    setActiveTabIdState(newTab.id);
    return newTab;
  }, [tabs]);

  const closeTab = useCallback((tabId: string) => {
    setTabs((currentTabs) => {
      const nextTabs = currentTabs.filter((tab) => tab.id !== tabId);

      setActiveTabIdState((currentActiveTabId) => {
        if (currentActiveTabId !== tabId) {
          return currentActiveTabId;
        }

        return findNextActiveTabId(currentTabs, tabId, nextTabs);
      });

      return nextTabs;
    });
  }, []);

  const renameTab = useCallback((tabId: string, title: string) => {
    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) {
      return;
    }

    setTabs((currentTabs) => currentTabs.map((tab) => tab.id === tabId
      ? { ...tab, title: trimmedTitle, isDirty: true, updatedAt: Date.now() }
      : tab));
  }, []);

  const updateTabSql = useCallback((tabId: string, sql: string) => {
    setTabs((currentTabs) => currentTabs.map((tab) => tab.id === tabId
      ? { ...tab, sql, isDirty: true, updatedAt: Date.now() }
      : tab));
  }, []);

  const updateTabExecution = useCallback((tabId: string, execution: QueryTabExecutionSnapshot | null) => {
    setTabs((currentTabs) => currentTabs.map((tab) => tab.id === tabId
      ? { ...tab, execution, updatedAt: Date.now() }
      : tab));
  }, []);

  const saveTab = useCallback((tabId: string) => {
    setTabs((currentTabs) => currentTabs.map((tab) => tab.id === tabId
      ? { ...tab, isDirty: false, updatedAt: Date.now() }
      : tab));
  }, []);

  const getTab = useCallback(
    (tabId: string) => tabs.find((tab) => tab.id === tabId),
    [tabs]
  );

  return {
    activeTab,
    activeTabId,
    addTab,
    closeTab,
    getTab,
    renameTab,
    saveTab,
    setActiveTabId,
    tabs,
    updateTabExecution,
    updateTabSql
  };
}

function createUniqueTabId(tabs: QueryTab[]): string {
  let id = createQueryTabId();
  const existingIds = new Set(tabs.map((tab) => tab.id));

  while (existingIds.has(id)) {
    id = createQueryTabId();
  }

  return id;
}

function nextQueryTitle(tabs: QueryTab[]): string {
  const usedNumbers = new Set(
    tabs
      .map((tab) => /^Query (?<number>\d+)$/.exec(tab.title)?.groups?.number)
      .filter((value): value is string => value !== undefined)
      .map(Number)
  );

  let index = 1;
  while (usedNumbers.has(index)) {
    index += 1;
  }

  return `Query ${index}`;
}

function findNextActiveTabId(previousTabs: QueryTab[], closedTabId: string, nextTabs: QueryTab[]): string | null {
  if (nextTabs.length === 0) {
    return null;
  }

  const closedIndex = previousTabs.findIndex((tab) => tab.id === closedTabId);
  const nextTab = nextTabs[Math.min(closedIndex, nextTabs.length - 1)];
  return nextTab?.id ?? null;
}
