import { useCallback, useEffect } from "react";
import { DriverFactory } from "@/lib/database-driver";
import {
  CELL_SEP,
  isQueryCancelledError,
  notifyQueryComplete,
  PAGE_SIZE,
  ROW_SEP,
} from "@/lib/query-helpers";
import * as virtualCache from "@/lib/virtual-cache";
import { useHistoryStore } from "@/stores/history-store";
import { useProjectStore } from "@/stores/project-store";
import { useTabStore } from "@/stores/tab-store";
import { useUIStore } from "@/stores/ui-store";

interface UseQueryLifecycleArgs {
  setCommandPaletteOpen: (updater: (v: boolean) => boolean) => void;
}

export function useQueryLifecycle({ setCommandPaletteOpen }: UseQueryLifecycleArgs) {
  const updateResult = useTabStore((s) => s.updateResult);
  const setExecuting = useTabStore((s) => s.setExecuting);
  const closeTab = useTabStore((s) => s.closeTab);
  const setExplainResult = useTabStore((s) => s.setExplainResult);
  const setVirtualQuery = useTabStore((s) => s.setVirtualQuery);
  const setSplitResult = useTabStore((s) => s.setSplitResult);
  const setSplitExecuting = useTabStore((s) => s.setSplitExecuting);
  const addHistoryEntry = useHistoryStore((s) => s.addEntry);
  const connectProject = useProjectStore((s) => s.connect);

  const runQuery = useCallback(async () => {
    const { tabs, selectedTabIndex: idx } = useTabStore.getState();
    const tab = tabs[idx];
    if (!tab?.projectId || !tab.editorValue.trim()) return;

    const d = useProjectStore.getState().projects[tab.projectId];
    if (!d) return;

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

      const prevVQ = tab.virtualQuery;
      if (prevVQ?.queryId) {
        await driver.closeVirtual?.(tab.projectId, prevVQ.queryId).catch(() => {});
        virtualCache.clearQuery(prevVQ.queryId);
        setVirtualQuery(idx, undefined);
      }

      const timeoutMs = tab.queryTimeout || undefined;

      if (driver.executeVirtual) {
        const sql = tab.editorValue;
        const queryId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
        const [colsPacked, totalRows, pagePacked, elapsed] = await driver.executeVirtual(
          tab.projectId,
          sql,
          queryId,
          PAGE_SIZE,
          timeoutMs,
        );

        if (!colsPacked) {
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
            setVirtualQuery(idx, {
              queryId,
              columns,
              totalRows,
              pageSize: PAGE_SIZE,
              colCount: columns.length,
              time: elapsed,
            });
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
        const [cols, rows, time] = await driver.runQuery(tab.projectId, tab.editorValue, timeoutMs);
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

    const connStatus = useProjectStore.getState().status[tab.projectId];
    if (connStatus !== "Connected") {
      await connectProject(tab.projectId);
      const newStatus = useProjectStore.getState().status[tab.projectId];
      if (newStatus !== "Connected") return;
    }

    setExecuting(idx, true);
    try {
      const driver = DriverFactory.getDriver(d.driver);
      // Strip trailing semicolons — wrapping in EXPLAIN(...) doesn't accept them
      const userSql = tab.editorValue.replace(/;\s*$/, "");
      const sql = `EXPLAIN (ANALYZE, FORMAT JSON) ${userSql}`;
      const [, rows] = await driver.runQuery(tab.projectId, sql);
      // PG returns the JSON plan as a single text cell; join all rows
      const jsonText = rows.map((r) => r[0]).join("\n");
      let plans: unknown;
      try {
        plans = JSON.parse(jsonText);
      } catch {
        // Some drivers split rows or wrap differently — fall back to extracting the JSON array
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

  const runSplitQuery = useCallback(async () => {
    const { tabs, selectedTabIndex: idx } = useTabStore.getState();
    const tab = tabs[idx];
    if (!tab?.projectId || !tab.splitEditorValue?.trim()) return;

    const d = useProjectStore.getState().projects[tab.projectId];
    if (!d) return;

    const connStatus = useProjectStore.getState().status[tab.projectId];
    if (connStatus !== "Connected") {
      await connectProject(tab.projectId);
      const newStatus = useProjectStore.getState().status[tab.projectId];
      if (newStatus !== "Connected") return;
    }

    setSplitExecuting(idx, true);
    try {
      const driver = DriverFactory.getDriver(d.driver);
      const [cols, rows, time] = await driver.runQuery(tab.projectId, tab.splitEditorValue);
      setSplitResult(idx, { columns: cols, rows, time });
    } catch (err: any) {
      const errorMsg = err?.message ?? String(err);
      const cancelled = isQueryCancelledError(errorMsg);
      setSplitResult(idx, {
        columns: [cancelled ? "Info" : "Error"],
        rows: [[cancelled ? "Query cancelled" : errorMsg]],
        time: 0,
      });
    }
  }, [setSplitExecuting, setSplitResult, connectProject]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "w") {
        e.preventDefault();
        const { tabs: t, selectedTabIndex: idx } = useTabStore.getState();
        if (t.length > 0) {
          const closingTab = t[idx];
          if (closingTab?.virtualQuery?.queryId && closingTab.projectId) {
            const dd = useProjectStore.getState().projects[closingTab.projectId];
            if (dd)
              DriverFactory.getDriver(dd.driver)
                .closeVirtual?.(closingTab.projectId, closingTab.virtualQuery.queryId)
                .catch(() => {});
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
  }, [cancelQuery, closeTab, runExplain, setCommandPaletteOpen]);

  return { runQuery, runExplain, cancelQuery, runSplitQuery };
}
