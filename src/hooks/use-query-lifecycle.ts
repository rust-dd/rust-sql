import { useCallback, useEffect } from "react";
import { DriverFactory } from "@/lib/database-driver";
import { changesSchema } from "@/lib/ddl-detect";
import { isQueryCancelledError, notifyQueryComplete, PAGE_SIZE } from "@/lib/query-helpers";
import * as virtualCache from "@/lib/virtual-cache";
import { decodeColumns, decodePage, decodeResult } from "@/lib/wire";
import { useHistoryStore } from "@/stores/history-store";
import { useProjectStore } from "@/stores/project-store";
import { useSchemaIndexStore } from "@/stores/schema-index-store";
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
    const { tabs, selectedTabIndex } = useTabStore.getState();
    const tab = tabs[selectedTabIndex];
    if (!tab?.projectId || !tab.editorValue.trim()) return;

    // Captured before the first await: the tab may move or close while the
    // query runs, and an index would then address someone else's tab.
    const tabId = tab.id;

    const d = useProjectStore.getState().projects[tab.projectId];
    if (!d) return;

    const connStatus = useProjectStore.getState().status[tab.projectId];
    if (connStatus !== "Connected") {
      await connectProject(tab.projectId);
      const newStatus = useProjectStore.getState().status[tab.projectId];
      if (newStatus !== "Connected") return;
    }

    const execId = crypto.randomUUID();
    setExecuting(tabId, true, execId);
    const startTime = Date.now();
    try {
      const driver = DriverFactory.getDriver(d.driver);

      const prevVQ = tab.virtualQuery;
      if (prevVQ?.queryId) {
        await driver.closeVirtual?.(tab.projectId, prevVQ.queryId).catch(() => {});
        virtualCache.clearQuery(prevVQ.queryId);
        setVirtualQuery(tabId, undefined);
      }

      const timeoutMs = tab.queryTimeout || undefined;

      if (driver.executeVirtual) {
        const sql = tab.editorValue;
        const queryId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
        const [colsPacked, totalRows, pagePacked, elapsed, capped] = await driver.executeVirtual(
          tab.projectId,
          sql,
          queryId,
          PAGE_SIZE,
          timeoutMs,
          execId,
        );

        if (!colsPacked) {
          const { columns, rows } = decodeResult(pagePacked);

          await driver.closeVirtual?.(tab.projectId, queryId).catch(() => {});
          updateResult(tabId, { columns, rows, time: elapsed });
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
          const columns = decodeColumns(colsPacked);
          const firstPage = decodePage(pagePacked);

          if (totalRows <= PAGE_SIZE) {
            await driver.closeVirtual?.(tab.projectId, queryId).catch(() => {});
            updateResult(tabId, { columns, rows: firstPage, time: elapsed, capped });
            notifyQueryComplete(tab.editorValue, elapsed, true, firstPage.length);
          } else {
            virtualCache.setPage(queryId, 0, firstPage);
            setVirtualQuery(tabId, {
              queryId,
              columns,
              totalRows,
              pageSize: PAGE_SIZE,
              colCount: columns.length,
              time: elapsed,
            });
            updateResult(tabId, { columns, rows: firstPage, time: elapsed, capped });
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
        const [cols, rows, time] = await driver.runQuery(
          tab.projectId,
          tab.editorValue,
          timeoutMs,
          execId,
        );
        updateResult(tabId, { columns: cols, rows, time });
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
      updateResult(tabId, {
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
    } finally {
      // Without this a failure inside the error path would leave the tab
      // spinning on "Executing query..." with no way back.
      setExecuting(tabId, false);
      // A DDL statement can have added or dropped what completion offers.
      if (changesSchema(tab.editorValue)) {
        useSchemaIndexStore.getState().invalidateProject(tab.projectId);
      }
    }
    useUIStore.getState().setSelectedRow(0);
  }, [setExecuting, updateResult, setVirtualQuery, addHistoryEntry, connectProject]);

  const runExplain = useCallback(async () => {
    const { tabs, selectedTabIndex } = useTabStore.getState();
    const tab = tabs[selectedTabIndex];
    if (!tab?.projectId || !tab.editorValue.trim()) return;
    const tabId = tab.id;

    const d = useProjectStore.getState().projects[tab.projectId];
    if (!d) return;

    const connStatus = useProjectStore.getState().status[tab.projectId];
    if (connStatus !== "Connected") {
      await connectProject(tab.projectId);
      const newStatus = useProjectStore.getState().status[tab.projectId];
      if (newStatus !== "Connected") return;
    }

    setExecuting(tabId, true);
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
        setExplainResult(tabId, plans[0]);
      }
    } catch (err: any) {
      const errorMsg = err?.message ?? String(err);
      const cancelled = isQueryCancelledError(errorMsg);
      updateResult(tabId, {
        columns: [cancelled ? "Info" : "Explain Error"],
        rows: [[cancelled ? "Explain cancelled" : errorMsg]],
        time: 0,
      });
      setExplainResult(tabId, undefined);
    }
    setExecuting(tabId, false);
  }, [setExecuting, updateResult, setExplainResult, connectProject]);

  const cancelQuery = useCallback(async () => {
    const { tabs, selectedTabIndex } = useTabStore.getState();
    const tab = tabs[selectedTabIndex];
    if (!tab?.projectId || !tab.isExecuting || !tab.execId) return;

    const d = useProjectStore.getState().projects[tab.projectId];
    if (!d) return;

    try {
      const driver = DriverFactory.getDriver(d.driver);
      await driver.cancelQuery?.(tab.execId);
    } catch (err) {
      console.error("Failed to cancel query:", err);
    }
  }, []);

  const runSplitQuery = useCallback(async () => {
    const { tabs, selectedTabIndex } = useTabStore.getState();
    const tab = tabs[selectedTabIndex];
    if (!tab?.projectId || !tab.splitEditorValue?.trim()) return;
    const tabId = tab.id;

    const d = useProjectStore.getState().projects[tab.projectId];
    if (!d) return;

    const connStatus = useProjectStore.getState().status[tab.projectId];
    if (connStatus !== "Connected") {
      await connectProject(tab.projectId);
      const newStatus = useProjectStore.getState().status[tab.projectId];
      if (newStatus !== "Connected") return;
    }

    setSplitExecuting(tabId, true);
    try {
      const driver = DriverFactory.getDriver(d.driver);
      const [cols, rows, time] = await driver.runQuery(tab.projectId, tab.splitEditorValue);
      setSplitResult(tabId, { columns: cols, rows, time });
    } catch (err: any) {
      const errorMsg = err?.message ?? String(err);
      const cancelled = isQueryCancelledError(errorMsg);
      setSplitResult(tabId, {
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
