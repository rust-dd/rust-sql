import { useState, useEffect, useCallback } from "react";
import { ConnectionModal } from "@/components/connection-modal";
import { ResizeHandle } from "@/components/resize-handle";
import { ServerSidebar } from "@/components/server-sidebar";
import { QueryEditor } from "@/components/query-editor";
import { ResultsPanel } from "@/components/results-panel";
import { PerformanceMonitor } from "@/components/performance-monitor";
import { ERDDiagram } from "@/components/erd-diagram";
import { TerminalPanel } from "@/components/terminal-panel";
import { TabBar } from "@/components/tab-bar";
import { TopBar } from "@/components/top-bar";
import { StatusBar } from "@/components/status-bar";
import { CommandPalette } from "@/components/command-palette";
import { DriverFactory } from "@/lib/database-driver";
import { checkForUpdates, startBackgroundUpdateCheck } from "@/lib/updater";
import * as virtualCache from "@/lib/virtual-cache";
import { useProjectStore } from "@/stores/project-store";
import { useTabStore, useActiveTab } from "@/stores/tab-store";
import { useUIStore } from "@/stores/ui-store";
import { useHistoryStore } from "@/stores/history-store";
import type { ProjectDetails } from "@/types";
import "@/monaco/setup";

const NOTIFY_THRESHOLD_MS = 5000;
const DEFAULT_PAGE_SIZE = 2_000;
const PAGE_SIZE_RAW = Number(import.meta.env.VITE_PAGE_SIZE ?? DEFAULT_PAGE_SIZE);
const PAGE_SIZE = Number.isFinite(PAGE_SIZE_RAW) && PAGE_SIZE_RAW >= 100
  ? Math.floor(PAGE_SIZE_RAW)
  : DEFAULT_PAGE_SIZE;
const CELL_SEP = "\x1F";
const ROW_SEP = "\x1E";

function isQueryCancelledError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("canceling statement due to user request")
    || lower.includes("cancelling statement due to user request")
    || lower.includes("query canceled")
    || lower.includes("query cancelled");
}

function notifyQueryComplete(sql: string, time: number, success: boolean, rowCount?: number) {
  if (document.hasFocus() || time < NOTIFY_THRESHOLD_MS) return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const preview = sql.slice(0, 60).replace(/\n/g, " ");
  const body = success
    ? `${rowCount?.toLocaleString() ?? 0} rows in ${(time / 1000).toFixed(1)}s`
    : `Query failed after ${(time / 1000).toFixed(1)}s`;
  new Notification(success ? "Query Complete" : "Query Failed", { body: `${preview}\n${body}` });
}

export default function App() {
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const editorHeight = useUIStore((s) => s.editorHeight);
  const connectionModalOpen = useUIStore((s) => s.connectionModalOpen);
  const setConnectionModalOpen = useUIStore((s) => s.setConnectionModalOpen);
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);
  const setEditorHeight = useUIStore((s) => s.setEditorHeight);

  const loadProjects = useProjectStore((s) => s.loadProjects);
  const projects = useProjectStore((s) => s.projects);
  const saveConnection = useProjectStore((s) => s.saveConnection);
  const updateConnection = useProjectStore((s) => s.updateConnection);

  const selectedTabIndex = useTabStore((s) => s.selectedTabIndex);
  const activeTab = useActiveTab();
  const updateContent = useTabStore((s) => s.updateContent);
  const updateResult = useTabStore((s) => s.updateResult);
  const setExecuting = useTabStore((s) => s.setExecuting);
  const closeTab = useTabStore((s) => s.closeTab);
  const setExplainResult = useTabStore((s) => s.setExplainResult);
  const setVirtualQuery = useTabStore((s) => s.setVirtualQuery);
  const addHistoryEntry = useHistoryStore((s) => s.addEntry);

  // Edit connection state
  const [editingConnection, setEditingConnection] = useState<{ name: string; details: ProjectDetails } | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    startBackgroundUpdateCheck();
  }, []);

  const connectProject = useProjectStore((s) => s.connect);

  const runQuery = useCallback(async () => {
    const { tabs, selectedTabIndex: idx } = useTabStore.getState();
    const tab = tabs[idx];
    if (!tab?.projectId || !tab.editorValue.trim()) return;

    const d = useProjectStore.getState().projects[tab.projectId];
    if (!d) return;

    // Auto-connect if not connected
    const connStatus = useProjectStore.getState().status[tab.projectId];
    if (connStatus !== "Connected") {
      await connectProject(tab.projectId);
      const newStatus = useProjectStore.getState().status[tab.projectId];
      if (newStatus !== "Connected") return;
    }

    setExecuting(idx, true);
    const startTime = Date.now();
    try {
      const driver = DriverFactory.getDriver(d.driver);

      // Clean up previous virtual query
      const prevVQ = tab.virtualQuery;
      if (prevVQ?.queryId) {
        await driver.closeVirtual?.(tab.projectId, prevVQ.queryId).catch(() => {});
        virtualCache.clearQuery(prevVQ.queryId);
        setVirtualQuery(idx, undefined);
      }

      if (driver.executeVirtual) {
        const sql = tab.editorValue;
        const queryId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
        const [colsPacked, totalRows, pagePacked, elapsed] =
          await driver.executeVirtual(tab.projectId, sql, queryId, PAGE_SIZE);

        if (!colsPacked) {
          // Fallback format from backend: header + rows in one packed string.
          const parts = pagePacked ? pagePacked.split(ROW_SEP) : [];
          const columns = parts[0] ? parts[0].split(CELL_SEP) : [];
          const rows = parts.slice(1).map((r) => r.split(CELL_SEP));

          await driver.closeVirtual?.(tab.projectId, queryId).catch(() => {});
          updateResult(idx, { columns, rows, time: elapsed });
          notifyQueryComplete(tab.editorValue, elapsed, true, rows.length);

          addHistoryEntry({
            projectId: tab.projectId,
            database: d.database,
            sql: tab.editorValue.trim(),
            executionTime: elapsed,
            rowCount: rows.length,
            success: true,
            timestamp: startTime,
          });
        } else {
          const columns = colsPacked.split(CELL_SEP);
          const firstPage = pagePacked
            ? pagePacked.split(ROW_SEP).map((r) => r.split(CELL_SEP))
            : [];

          if (totalRows <= PAGE_SIZE) {
            await driver.closeVirtual?.(tab.projectId, queryId).catch(() => {});
            updateResult(idx, { columns, rows: firstPage, time: elapsed });
            notifyQueryComplete(tab.editorValue, elapsed, true, firstPage.length);
          } else {
            virtualCache.setPage(queryId, 0, firstPage);
            setVirtualQuery(idx, { queryId, columns, totalRows, pageSize: PAGE_SIZE, colCount: columns.length, time: elapsed });
            updateResult(idx, { columns, rows: firstPage, time: elapsed });
            notifyQueryComplete(tab.editorValue, elapsed, true, totalRows);
          }

          addHistoryEntry({
            projectId: tab.projectId,
            database: d.database,
            sql: tab.editorValue.trim(),
            executionTime: elapsed,
            rowCount: totalRows > PAGE_SIZE ? totalRows : firstPage.length,
            success: true,
            timestamp: startTime,
          });
        }
      } else {
        // One-shot fallback
        const [cols, rows, time] = await driver.runQuery(tab.projectId, tab.editorValue);
        updateResult(idx, { columns: cols, rows, time });
        notifyQueryComplete(tab.editorValue, time, true, rows.length);
        addHistoryEntry({
          projectId: tab.projectId,
          database: d.database,
          sql: tab.editorValue.trim(),
          executionTime: time,
          rowCount: rows.length,
          success: true,
          timestamp: startTime,
        });
      }
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      const errorMsg = err?.message ?? String(err);
      const cancelled = isQueryCancelledError(errorMsg);
      updateResult(idx, {
        columns: [cancelled ? "Info" : "Error"],
        rows: [[cancelled ? "Query cancelled" : errorMsg]],
        time: 0,
      });
      if (!cancelled) {
        notifyQueryComplete(tab.editorValue, elapsed, false);
      }
      addHistoryEntry({
        projectId: tab.projectId,
        database: d.database,
        sql: tab.editorValue.trim(),
        executionTime: elapsed,
        rowCount: 0,
        success: false,
        error: cancelled ? "Query cancelled" : errorMsg,
        timestamp: startTime,
      });
    }
    useUIStore.getState().setSelectedRow(0);
  }, [setExecuting, updateResult, setVirtualQuery, addHistoryEntry, connectProject]);

  const runExplain = useCallback(async () => {
    const { tabs, selectedTabIndex: idx } = useTabStore.getState();
    const tab = tabs[idx];
    if (!tab?.projectId || !tab.editorValue.trim()) return;

    const d = useProjectStore.getState().projects[tab.projectId];
    if (!d) return;

    // Auto-connect if not connected
    const connStatus = useProjectStore.getState().status[tab.projectId];
    if (connStatus !== "Connected") {
      await connectProject(tab.projectId);
      const newStatus = useProjectStore.getState().status[tab.projectId];
      if (newStatus !== "Connected") return;
    }

    setExecuting(idx, true);
    try {
      const driver = DriverFactory.getDriver(d.driver);
      // Strip trailing semicolons from user's query to avoid syntax errors
      const userSql = tab.editorValue.replace(/;\s*$/, "");
      const sql = `EXPLAIN (ANALYZE, FORMAT JSON) ${userSql}`;
      const [, rows] = await driver.runQuery(tab.projectId, sql);
      // PG returns the JSON plan as a single text cell; join all rows
      const jsonText = rows.map((r) => r[0]).join("\n");
      let plans: unknown;
      try {
        plans = JSON.parse(jsonText);
      } catch {
        // Some drivers return each row separately or wrap in brackets
        // Try finding valid JSON within the text
        const match = jsonText.match(/\[[\s\S]*\]/);
        if (match) {
          plans = JSON.parse(match[0]);
        } else {
          throw new Error(`Could not parse EXPLAIN output:\n${jsonText.slice(0, 500)}`);
        }
      }
      if (Array.isArray(plans) && plans.length > 0) {
        setExplainResult(idx, plans[0]);
      }
    } catch (err: any) {
      const errorMsg = err?.message ?? String(err);
      const cancelled = isQueryCancelledError(errorMsg);
      updateResult(idx, {
        columns: [cancelled ? "Info" : "Explain Error"],
        rows: [[cancelled ? "Explain cancelled" : errorMsg]],
        time: 0,
      });
      setExplainResult(idx, undefined);
    }
    setExecuting(idx, false);
  }, [setExecuting, updateResult, setExplainResult, connectProject]);

  const cancelQuery = useCallback(async () => {
    const { tabs, selectedTabIndex: idx } = useTabStore.getState();
    const tab = tabs[idx];
    if (!tab?.projectId || !tab.isExecuting) return;

    const d = useProjectStore.getState().projects[tab.projectId];
    if (!d) return;

    try {
      const driver = DriverFactory.getDriver(d.driver);
      await driver.cancelQuery?.(tab.projectId);
    } catch (err) {
      console.error("Failed to cancel query:", err);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "w") {
        e.preventDefault();
        const { tabs: t, selectedTabIndex: idx } = useTabStore.getState();
        if (t.length > 1) {
          const closingTab = t[idx];
          if (closingTab?.virtualQuery?.queryId && closingTab.projectId) {
            const dd = useProjectStore.getState().projects[closingTab.projectId];
            if (dd) DriverFactory.getDriver(dd.driver).closeVirtual?.(closingTab.projectId, closingTab.virtualQuery.queryId).catch(() => {});
            virtualCache.clearQuery(closingTab.virtualQuery.queryId);
          }
          closeTab(idx);
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "Enter") {
        e.preventDefault();
        void runExplain();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "p" || e.key === "k")) {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "`") {
        e.preventDefault();
        useTabStore.getState().openTerminalTab();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        void cancelQuery();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cancelQuery, closeTab, runExplain]);

  const handleSaveConnection = useCallback(
    async (connection: { name: string; driver: string; username: string; password: string; database: string; host: string; port: string; ssl: boolean }) => {
      const details = {
        driver: connection.driver as "PGSQL",
        username: connection.username,
        password: connection.password,
        database: connection.database,
        host: connection.host,
        port: connection.port,
        ssl: connection.ssl ? "true" : "false",
      };
      if (editingConnection) {
        await updateConnection(connection.name, details);
        setEditingConnection(null);
      } else {
        await saveConnection(connection.name, details);
      }
    },
    [saveConnection, updateConnection, editingConnection],
  );

  const handleEditConnection = useCallback(
    (projectId: string) => {
      const details = projects[projectId];
      if (details) {
        setEditingConnection({ name: projectId, details });
        setConnectionModalOpen(true);
      }
    },
    [projects, setConnectionModalOpen],
  );

  const handleModalClose = useCallback(
    (open: boolean) => {
      if (!open) setEditingConnection(null);
      setConnectionModalOpen(open);
    },
    [setConnectionModalOpen],
  );

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TopBar
        onExecute={() => void runQuery()}
        onExplain={() => void runExplain()}
        onCheckUpdates={() => void checkForUpdates()}
      />

      <div className="flex flex-1 overflow-hidden">
        <div style={{ width: `${sidebarWidth}px`, minWidth: "180px" }} className="flex-shrink-0 overflow-hidden">
          <ServerSidebar onEditConnection={handleEditConnection} />
        </div>
        <ResizeHandle direction="horizontal" onResize={setSidebarWidth} />

        <div className="flex flex-1 flex-col overflow-hidden">
          <TabBar />
          {activeTab?.type === "monitor" && activeTab.projectId ? (
            <div className="flex-1 min-h-0 overflow-hidden">
              <PerformanceMonitor projectId={activeTab.projectId} />
            </div>
          ) : activeTab?.type === "erd" && activeTab.projectId && activeTab.schema ? (
            <div className="flex-1 min-h-0 overflow-hidden">
              <ERDDiagram projectId={activeTab.projectId} schema={activeTab.schema} />
            </div>
          ) : activeTab?.type === "terminal" ? (
            <div className="flex-1 min-h-0 overflow-hidden">
              <TerminalPanel terminalId={activeTab.id} />
            </div>
          ) : (
            <>
              <div style={{ height: `${editorHeight}%` }} className="flex flex-col overflow-hidden">
                <QueryEditor
                  value={activeTab?.editorValue ?? ""}
                  onChange={(v) => updateContent(selectedTabIndex, v)}
                  onExecute={() => void runQuery()}
                  onExplain={() => void runExplain()}
                />
              </div>
              <ResizeHandle direction="vertical" onResize={setEditorHeight} />
              <div className="flex-1 min-h-0">
                <ResultsPanel />
              </div>
            </>
          )}
        </div>
      </div>

      <StatusBar />

      <ConnectionModal
        open={connectionModalOpen}
        onOpenChange={handleModalClose}
        onSave={handleSaveConnection}
        editData={editingConnection}
      />

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onExecute={() => void runQuery()}
        onExplain={() => void runExplain()}
        onCheckUpdates={() => void checkForUpdates()}
      />
    </div>
  );
}
