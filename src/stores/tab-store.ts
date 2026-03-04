import { create } from "zustand";
import type { Tab, QueryResult } from "@/types";

let nextId = 1;
function genTabId(): string {
  return `tab-${nextId++}-${Date.now()}`;
}

interface TabState {
  tabs: Tab[];
  selectedTabIndex: number;

  openTab: (projectId?: string, editorValue?: string) => void;
  openMonitorTab: (projectId: string) => void;
  closeTab: (index: number) => void;
  selectTab: (index: number) => void;
  updateContent: (index: number, value: string) => void;
  updateResult: (index: number, result: QueryResult) => void;
  setExecuting: (index: number, executing: boolean) => void;
  setProjectId: (index: number, projectId: string) => void;
}

export const useTabStore = create<TabState>((set) => ({
  tabs: [{ id: genTabId(), type: "query", title: "Query 1", editorValue: "", isExecuting: false }],
  selectedTabIndex: 0,

  openTab: (projectId?: string, editorValue: string = "") => {
    set((s) => {
      const newTab: Tab = {
        id: genTabId(),
        type: "query",
        projectId,
        title: `Query ${s.tabs.length + 1}`,
        editorValue,
        isExecuting: false,
      };
      return {
        tabs: [...s.tabs, newTab],
        selectedTabIndex: s.tabs.length,
      };
    });
  },

  openMonitorTab: (projectId: string) => {
    set((s) => {
      // Check if there's already a monitor tab for this project
      const existing = s.tabs.findIndex((t) => t.type === "monitor" && t.projectId === projectId);
      if (existing >= 0) return { selectedTabIndex: existing };

      const newTab: Tab = {
        id: genTabId(),
        type: "monitor",
        projectId,
        title: `Monitor`,
        editorValue: "",
        isExecuting: false,
      };
      return {
        tabs: [...s.tabs, newTab],
        selectedTabIndex: s.tabs.length,
      };
    });
  },

  closeTab: (index: number) => {
    set((s) => {
      if (s.tabs.length <= 1) return s;
      const newTabs = s.tabs.filter((_, i) => i !== index);
      let newSelected = s.selectedTabIndex;
      if (newSelected >= newTabs.length) {
        newSelected = newTabs.length - 1;
      } else if (newSelected > index) {
        newSelected = newSelected - 1;
      } else if (newSelected === index && newSelected > 0) {
        newSelected = newSelected - 1;
      }
      return { tabs: newTabs, selectedTabIndex: newSelected };
    });
  },

  selectTab: (index: number) => {
    set({ selectedTabIndex: index });
  },

  updateContent: (index: number, value: string) => {
    set((s) => {
      const tabs = s.tabs.slice();
      tabs[index] = { ...tabs[index], editorValue: value };
      return { tabs };
    });
  },

  updateResult: (index: number, result: QueryResult) => {
    set((s) => {
      const tabs = s.tabs.slice();
      tabs[index] = { ...tabs[index], result, isExecuting: false };
      return { tabs };
    });
  },

  setExecuting: (index: number, executing: boolean) => {
    set((s) => {
      const tabs = s.tabs.slice();
      tabs[index] = { ...tabs[index], isExecuting: executing };
      return { tabs };
    });
  },

  setProjectId: (index: number, projectId: string) => {
    set((s) => {
      const tabs = s.tabs.slice();
      tabs[index] = { ...tabs[index], projectId };
      return { tabs };
    });
  },
}));

/** Derived selector: get active tab reactively */
export function useActiveTab(): Tab | undefined {
  return useTabStore((s) => s.tabs[s.selectedTabIndex]);
}
