import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
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
  openExtensionsTab: (projectId: string) => void;
  openEnumsTab: (projectId: string) => void;
  openPgSettingsTab: (projectId: string) => void;
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
  setQueryTimeout: (index: number, timeout: number) => void;
}

function makeSingletonTab(
  type: Tab["type"],
  projectId: string,
  title: string,
  schema?: string,
): (s: TabState) => void {
  return (s) => {
    const existing = s.tabs.findIndex(
      (t) =>
        t.type === type &&
        t.projectId === projectId &&
        (!schema || t.schema === schema),
    );
    if (existing >= 0) {
      s.selectedTabIndex = existing;
      return;
    }
    const newTab: Tab = {
      id: genTabId(),
      type,
      projectId,
      schema,
      title,
      editorValue: "",
      isExecuting: false,
    };
    s.tabs.push(newTab);
    s.selectedTabIndex = s.tabs.length - 1;
  };
}

export const useTabStore = create<TabState>()(
  persist(
    immer((set) => ({
      tabs: [
        {
          id: genTabId(),
          type: "query",
          title: "Query 1",
          editorValue: "",
          isExecuting: false,
        },
      ],
      selectedTabIndex: 0,

      openTab: (projectId?: string, editorValue: string = "") => {
        set((s) => {
          s.tabs.push({
            id: genTabId(),
            type: "query",
            projectId,
            title: `Query ${s.tabs.length + 1}`,
            editorValue,
            isExecuting: false,
          });
          s.selectedTabIndex = s.tabs.length - 1;
        });
      },

      openMonitorTab: (projectId) =>
        set(makeSingletonTab("monitor", projectId, "Monitor")),
      openERDTab: (projectId, schema) =>
        set(makeSingletonTab("erd", projectId, `ERD: ${schema}`, schema)),
      openTerminalTab: () => {
        set((s) => {
          s.tabs.push({
            id: genTabId(),
            type: "terminal",
            title: "Terminal",
            editorValue: "",
            isExecuting: false,
          });
          s.selectedTabIndex = s.tabs.length - 1;
        });
      },
      openNotifyTab: (projectId) =>
        set(makeSingletonTab("notify", projectId, "LISTEN/NOTIFY")),
      openRolesTab: (projectId) =>
        set(makeSingletonTab("roles", projectId, "Roles")),
      openSchemaDiffTab: (projectId) =>
        set(makeSingletonTab("schema-diff", projectId, "Schema Diff")),
      openExtensionsTab: (projectId) =>
        set(makeSingletonTab("extensions", projectId, "Extensions")),
      openEnumsTab: (projectId) =>
        set(makeSingletonTab("enums", projectId, "Enum Types")),
      openPgSettingsTab: (projectId) =>
        set(makeSingletonTab("pg-settings", projectId, "PG Settings")),

      closeTab: (index) => {
        set((s) => {
          s.tabs.splice(index, 1);
          if (s.tabs.length === 0) {
            s.selectedTabIndex = -1;
          } else if (s.selectedTabIndex >= s.tabs.length) {
            s.selectedTabIndex = s.tabs.length - 1;
          } else if (s.selectedTabIndex > index) {
            s.selectedTabIndex--;
          } else if (s.selectedTabIndex === index && s.selectedTabIndex > 0) {
            s.selectedTabIndex--;
          }
        });
      },

      closeAllTabs: () =>
        set((s) => {
          s.tabs = [];
          s.selectedTabIndex = -1;
        }),

      closeOtherTabs: (index) => {
        set((s) => {
          const keep = s.tabs[index];
          if (!keep) return;
          s.tabs = [keep];
          s.selectedTabIndex = 0;
        });
      },

      selectTab: (index) =>
        set((s) => {
          s.selectedTabIndex = index;
        }),

      updateContent: (index, value) =>
        set((s) => {
          s.tabs[index].editorValue = value;
        }),
      updateResult: (index, result) =>
        set((s) => {
          s.tabs[index].result = result;
          s.tabs[index].isExecuting = false;
        }),
      setResult: (index, result) =>
        set((s) => {
          s.tabs[index].result = result;
        }),
      setExecuting: (index, executing) =>
        set((s) => {
          s.tabs[index].isExecuting = executing;
        }),
      setProjectId: (index, projectId) =>
        set((s) => {
          s.tabs[index].projectId = projectId;
        }),
      setExplainResult: (index, plan) =>
        set((s) => {
          s.tabs[index].explainResult = plan;
        }),
      setVirtualQuery: (index, vq) =>
        set((s) => {
          s.tabs[index].virtualQuery = vq;
        }),

      toggleSplit: (index) => {
        set((s) => {
          const tab = s.tabs[index];
          if (!tab || tab.type !== "query") return;
          tab.isSplit = !tab.isSplit;
          tab.splitEditorValue = tab.splitEditorValue ?? "";
        });
      },

      updateSplitContent: (index, value) =>
        set((s) => {
          s.tabs[index].splitEditorValue = value;
        }),
      setSplitResult: (index, result) =>
        set((s) => {
          s.tabs[index].splitResult = result;
          s.tabs[index].isSplitExecuting = false;
        }),
      setSplitExecuting: (index, executing) =>
        set((s) => {
          s.tabs[index].isSplitExecuting = executing;
        }),
      setQueryTimeout: (index, timeout) =>
        set((s) => {
          s.tabs[index].queryTimeout = timeout;
        }),
    })),
    {
      name: "rsql-tabs",
      partialize: (state) => ({
        tabs: state.tabs
          .filter((tab) => tab.type !== "terminal" && tab.type !== "notify")
          .map((tab) => ({
            id: tab.id,
            type: tab.type,
            projectId: tab.projectId,
            schema: tab.schema,
            title: tab.title,
            editorValue: tab.editorValue,
            isExecuting: false,
            queryTimeout: tab.queryTimeout,
            isSplit: tab.isSplit,
            splitEditorValue: tab.splitEditorValue,
          })),
        selectedTabIndex:
          state.tabs.filter((t) => t.type !== "terminal").length === 0
            ? -1
            : Math.min(
                state.selectedTabIndex,
                state.tabs.filter((t) => t.type !== "terminal").length - 1,
              ),
      }),
      merge: (persisted: unknown, current: TabState) => {
        const p = persisted as Partial<TabState> | undefined;
        if (!p?.tabs || !Array.isArray(p.tabs)) return current;
        if (p.tabs.length === 0)
          return { ...current, tabs: [], selectedTabIndex: -1 };
        const validTabs = p.tabs.filter(
          (t): t is Tab =>
            t != null &&
            typeof t === "object" &&
            "id" in t &&
            "type" in t &&
            "title" in t,
        );
        if (validTabs.length === 0)
          return { ...current, tabs: [], selectedTabIndex: -1 };
        const idx = Math.min(
          Math.max(0, p.selectedTabIndex ?? 0),
          validTabs.length - 1,
        );
        return { ...current, tabs: validTabs, selectedTabIndex: idx };
      },
    },
  ),
);

/** Derived selector: get active tab reactively */
export function useActiveTab(): Tab | undefined {
  return useTabStore((s) => s.tabs[s.selectedTabIndex]);
}
