import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Tab, QueryResult, ExplainPlan, VirtualQuery } from "@/types";

let nextId = 1;
function genTabId(): string {
  return `tab-${nextId++}-${Date.now()}`;
}

interface TabState {
  tabs: Tab[];
  selectedTabIndex: number;

  openTab: (projectId?: string, editorValue?: string) => void;
  openMonitorTab: (projectId: string) => void;
  openERDTab: (projectId: string, schema: string) => void;
  openTerminalTab: () => void;
  openNotifyTab: (projectId: string) => void;
  openRolesTab: (projectId: string) => void;
  openSchemaDiffTab: (projectId: string) => void;
  closeTab: (index: number) => void;
  closeAllTabs: () => void;
  closeOtherTabs: (index: number) => void;
  selectTab: (index: number) => void;
  updateContent: (index: number, value: string) => void;
  updateResult: (index: number, result: QueryResult) => void;
  setResult: (index: number, result: QueryResult) => void;
  setExecuting: (index: number, executing: boolean) => void;
  setProjectId: (index: number, projectId: string) => void;
  setExplainResult: (index: number, plan: ExplainPlan | undefined) => void;
  setVirtualQuery: (index: number, vq: VirtualQuery | undefined) => void;
  toggleSplit: (index: number) => void;
  updateSplitContent: (index: number, value: string) => void;
  setSplitResult: (index: number, result: QueryResult) => void;
  setSplitExecuting: (index: number, executing: boolean) => void;
}

export const useTabStore = create<TabState>()(
  persist(
    (set) => ({
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

      openERDTab: (projectId: string, schema: string) => {
        set((s) => {
          const existing = s.tabs.findIndex((t) => t.type === "erd" && t.projectId === projectId && t.schema === schema);
          if (existing >= 0) return { selectedTabIndex: existing };

          const newTab: Tab = {
            id: genTabId(),
            type: "erd",
            projectId,
            schema,
            title: `ERD: ${schema}`,
            editorValue: "",
            isExecuting: false,
          };
          return {
            tabs: [...s.tabs, newTab],
            selectedTabIndex: s.tabs.length,
          };
        });
      },

      openTerminalTab: () => {
        set((s) => {
          const newTab: Tab = {
            id: genTabId(),
            type: "terminal",
            title: "Terminal",
            editorValue: "",
            isExecuting: false,
          };
          return {
            tabs: [...s.tabs, newTab],
            selectedTabIndex: s.tabs.length,
          };
        });
      },

      openNotifyTab: (projectId: string) => {
        set((s) => {
          const existing = s.tabs.findIndex((t) => t.type === "notify" && t.projectId === projectId);
          if (existing >= 0) return { selectedTabIndex: existing };
          const newTab: Tab = { id: genTabId(), type: "notify", projectId, title: "LISTEN/NOTIFY", editorValue: "", isExecuting: false };
          return { tabs: [...s.tabs, newTab], selectedTabIndex: s.tabs.length };
        });
      },

      openRolesTab: (projectId: string) => {
        set((s) => {
          const existing = s.tabs.findIndex((t) => t.type === "roles" && t.projectId === projectId);
          if (existing >= 0) return { selectedTabIndex: existing };
          const newTab: Tab = { id: genTabId(), type: "roles", projectId, title: "Roles", editorValue: "", isExecuting: false };
          return { tabs: [...s.tabs, newTab], selectedTabIndex: s.tabs.length };
        });
      },

      openSchemaDiffTab: (projectId: string) => {
        set((s) => {
          const existing = s.tabs.findIndex((t) => t.type === "schema-diff" && t.projectId === projectId);
          if (existing >= 0) return { selectedTabIndex: existing };
          const newTab: Tab = { id: genTabId(), type: "schema-diff", projectId, title: "Schema Diff", editorValue: "", isExecuting: false };
          return { tabs: [...s.tabs, newTab], selectedTabIndex: s.tabs.length };
        });
      },

      closeTab: (index: number) => {
        set((s) => {
          const newTabs = s.tabs.filter((_, i) => i !== index);
          if (newTabs.length === 0) return { tabs: [], selectedTabIndex: -1 };
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

      closeAllTabs: () => {
        set(() => ({ tabs: [], selectedTabIndex: -1 }));
      },

      closeOtherTabs: (index: number) => {
        set((s) => {
          const keep = s.tabs[index];
          if (!keep) return s;
          return { tabs: [keep], selectedTabIndex: 0 };
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

      setResult: (index: number, result: QueryResult) => {
        set((s) => {
          const tabs = s.tabs.slice();
          tabs[index] = { ...tabs[index], result };
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

      setExplainResult: (index: number, plan: ExplainPlan | undefined) => {
        set((s) => {
          const tabs = s.tabs.slice();
          tabs[index] = { ...tabs[index], explainResult: plan };
          return { tabs };
        });
      },

      setVirtualQuery: (index: number, vq: VirtualQuery | undefined) => {
        set((s) => {
          const tabs = s.tabs.slice();
          tabs[index] = { ...tabs[index], virtualQuery: vq };
          return { tabs };
        });
      },

      toggleSplit: (index: number) => {
        set((s) => {
          const tabs = s.tabs.slice();
          const tab = tabs[index];
          if (!tab || tab.type !== "query") return s;
          tabs[index] = { ...tab, isSplit: !tab.isSplit, splitEditorValue: tab.splitEditorValue ?? "" };
          return { tabs };
        });
      },

      updateSplitContent: (index: number, value: string) => {
        set((s) => {
          const tabs = s.tabs.slice();
          tabs[index] = { ...tabs[index], splitEditorValue: value };
          return { tabs };
        });
      },

      setSplitResult: (index: number, result: QueryResult) => {
        set((s) => {
          const tabs = s.tabs.slice();
          tabs[index] = { ...tabs[index], splitResult: result, isSplitExecuting: false };
          return { tabs };
        });
      },

      setSplitExecuting: (index: number, executing: boolean) => {
        set((s) => {
          const tabs = s.tabs.slice();
          tabs[index] = { ...tabs[index], isSplitExecuting: executing };
          return { tabs };
        });
      },
    }),
    {
      name: "rsql-tabs",
      partialize: (state) => ({
        tabs: state.tabs
          .filter((tab) => tab.type !== "terminal" && tab.type !== "notify") // Terminal/notify tabs can't be restored
          .map((tab) => ({
            id: tab.id,
            type: tab.type,
            projectId: tab.projectId,
            schema: tab.schema,
            title: tab.title,
            editorValue: tab.editorValue,
            isExecuting: false,
            isSplit: tab.isSplit,
            splitEditorValue: tab.splitEditorValue,
          })),
        selectedTabIndex: state.tabs.filter((t) => t.type !== "terminal").length === 0 ? -1 : Math.min(state.selectedTabIndex, state.tabs.filter((t) => t.type !== "terminal").length - 1),
      }),
      merge: (persisted: unknown, current: TabState) => {
        const p = persisted as Partial<TabState> | undefined;
        if (!p?.tabs || !Array.isArray(p.tabs)) return current;
        // Allow empty tabs array (zero tabs state)
        if (p.tabs.length === 0) return { ...current, tabs: [], selectedTabIndex: -1 };
        // Filter out any invalid tabs (missing required fields)
        const validTabs = p.tabs.filter(
          (t): t is Tab => t != null && typeof t === "object" && "id" in t && "type" in t && "title" in t,
        );
        if (validTabs.length === 0) return { ...current, tabs: [], selectedTabIndex: -1 };
        const idx = Math.min(Math.max(0, p.selectedTabIndex ?? 0), validTabs.length - 1);
        return { ...current, tabs: validTabs, selectedTabIndex: idx };
      },
    },
  ),
);

/** Derived selector: get active tab reactively */
export function useActiveTab(): Tab | undefined {
  return useTabStore((s) => s.tabs[s.selectedTabIndex]);
}
