import { create } from "zustand";
import type { EditorTab, QueryResult } from "../types";
import { pickResultSubTab } from "../utils/queryResult";

function newTabId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function defaultTitle(index: number): string {
  return `SQL ${index}`;
}

export type ResultSubTab = "results" | "messages";

export interface EditorState {
  tabs: EditorTab[];
  activeTabId: string;
  results: Record<string, QueryResult | null>;
  /** When each worksheet last received a result (for message timestamps). */
  resultReceivedAt: Record<string, number>;
  /** Results vs Messages inner tab per worksheet tab. */
  resultSubTabByTab: Record<string, ResultSubTab>;
  executeLoading: boolean;

  addTab: (title?: string) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateContent: (id: string, content: string) => void;
  setResult: (tabId: string, result: QueryResult | null) => void;
  /** After Execute: result + timestamp + Results vs Messages tab in one update. */
  applyExecutionResult: (tabId: string, result: QueryResult) => void;
  setResultSubTab: (editorTabId: string, sub: ResultSubTab) => void;
  renameTab: (id: string, title: string) => void;
  setTabConnection: (tabId: string, connectionId: string) => void;
  setExecuteLoading: (loading: boolean) => void;
}

const initialTabId = newTabId();

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [{ id: initialTabId, title: defaultTitle(1), content: "" }],
  activeTabId: initialTabId,
  results: {},
  resultReceivedAt: {},
  resultSubTabByTab: {},
  executeLoading: false,

  addTab: (title?: string) => {
    const nextIndex = get().tabs.length + 1;
    const id = newTabId();
    const tab: EditorTab = {
      id,
      title: title?.trim() || defaultTitle(nextIndex),
      content: "",
    };
    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabId: id,
    }));
  },

  closeTab: (id: string) => {
    const s0 = get();
    const { tabs, activeTabId, results, resultReceivedAt, resultSubTabByTab } =
      s0;
    if (tabs.length <= 1) {
      return;
    }
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx < 0) {
      return;
    }
    const nextTabs = tabs.filter((t) => t.id !== id);
    const nextResults = { ...results };
    delete nextResults[id];
    const nextReceived = { ...resultReceivedAt };
    delete nextReceived[id];
    const nextSub = { ...resultSubTabByTab };
    delete nextSub[id];

    let nextActive = activeTabId;
    if (activeTabId === id) {
      const fallback = nextTabs[Math.max(0, idx - 1)] ?? nextTabs[0];
      nextActive = fallback.id;
    }

    set({
      tabs: nextTabs,
      activeTabId: nextActive,
      results: nextResults,
      resultReceivedAt: nextReceived,
      resultSubTabByTab: nextSub,
    });
  },

  setActiveTab: (id: string) => {
    if (!get().tabs.some((t) => t.id === id)) {
      return;
    }
    set({ activeTabId: id });
  },

  updateContent: (id: string, content: string) => {
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, content } : t)),
    }));
  },

  setResult: (tabId: string, result: QueryResult | null) => {
    set((s) => {
      const nextResults = { ...s.results, [tabId]: result };
      const nextAt = { ...s.resultReceivedAt };
      if (result === null) {
        delete nextAt[tabId];
      } else {
        nextAt[tabId] = Date.now();
      }
      return { results: nextResults, resultReceivedAt: nextAt };
    });
  },

  applyExecutionResult: (tabId: string, result: QueryResult) => {
    const at = Date.now();
    set((s) => ({
      results: { ...s.results, [tabId]: result },
      resultReceivedAt: { ...s.resultReceivedAt, [tabId]: at },
      resultSubTabByTab: {
        ...s.resultSubTabByTab,
        [tabId]: pickResultSubTab(result),
      },
    }));
  },

  setResultSubTab: (editorTabId: string, sub: ResultSubTab) => {
    set((s) => ({
      resultSubTabByTab: { ...s.resultSubTabByTab, [editorTabId]: sub },
    }));
  },

  renameTab: (id: string, title: string) => {
    const t = title.trim();
    if (!t) {
      return;
    }
    set((s) => ({
      tabs: s.tabs.map((tab) => (tab.id === id ? { ...tab, title: t } : tab)),
    }));
  },

  setTabConnection: (tabId: string, connectionId: string) => {
    set((s) => ({
      tabs: s.tabs.map((tab) =>
        tab.id === tabId
          ? {
              ...tab,
              connectionId: connectionId.trim() || undefined,
            }
          : tab
      ),
    }));
  },

  setExecuteLoading: (loading: boolean) => {
    set({ executeLoading: loading });
  },
}));
