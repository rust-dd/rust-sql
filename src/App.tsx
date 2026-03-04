import { useState, useEffect, useCallback } from "react";
import { ConnectionModal } from "@/components/connection-modal";
import { ResizeHandle } from "@/components/resize-handle";
import { ServerSidebar } from "@/components/server-sidebar";
import { QueryEditor } from "@/components/query-editor";
import { ResultsPanel } from "@/components/results-panel";
import { PerformanceMonitor } from "@/components/performance-monitor";
import { TabBar } from "@/components/tab-bar";
import { TopBar } from "@/components/top-bar";
import { StatusBar } from "@/components/status-bar";
import { DriverFactory } from "@/lib/database-driver";
import { useProjectStore } from "@/stores/project-store";
import { useTabStore, useActiveTab } from "@/stores/tab-store";
import { useUIStore } from "@/stores/ui-store";
import { useHistoryStore } from "@/stores/history-store";
import type { ProjectDetails } from "@/types";
import "@/monaco/setup";

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
  const addHistoryEntry = useHistoryStore((s) => s.addEntry);

  // Edit connection state
  const [editingConnection, setEditingConnection] = useState<{ name: string; details: ProjectDetails } | null>(null);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const runQuery = useCallback(async () => {
    const { tabs, selectedTabIndex: idx } = useTabStore.getState();
    const tab = tabs[idx];
    if (!tab?.projectId || !tab.editorValue.trim()) return;

    const d = useProjectStore.getState().projects[tab.projectId];
    if (!d) return;

    setExecuting(idx, true);
    const startTime = Date.now();
    try {
      const driver = DriverFactory.getDriver(d.driver);
      const [cols, rows, time] = await driver.runQuery(tab.projectId, tab.editorValue);
      updateResult(idx, { columns: cols, rows, time });
      addHistoryEntry({
        projectId: tab.projectId,
        database: d.database,
        sql: tab.editorValue.trim(),
        executionTime: time,
        rowCount: rows.length,
        success: true,
        timestamp: startTime,
      });
    } catch (err: any) {
      const errorMsg = err?.message ?? String(err);
      updateResult(idx, {
        columns: ["Error"],
        rows: [[errorMsg]],
        time: 0,
      });
      addHistoryEntry({
        projectId: tab.projectId,
        database: d.database,
        sql: tab.editorValue.trim(),
        executionTime: Date.now() - startTime,
        rowCount: 0,
        success: false,
        error: errorMsg,
        timestamp: startTime,
      });
    }
    useUIStore.getState().setSelectedRow(0);
  }, [setExecuting, updateResult, addHistoryEntry]);

  const handleSaveConnection = useCallback(
    async (connection: { name: string; driver: string; username: string; password: string; database: string; host: string; port: string; ssl: boolean }) => {
      const details = {
        driver: connection.driver as "PGSQL" | "REDSHIFT",
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
      <TopBar onExecute={() => void runQuery()} />

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
          ) : (
            <>
              <div style={{ height: `${editorHeight}%` }} className="flex flex-col overflow-hidden">
                <QueryEditor
                  value={activeTab?.editorValue ?? ""}
                  onChange={(v) => updateContent(selectedTabIndex, v)}
                  onExecute={() => void runQuery()}
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
    </div>
  );
}
