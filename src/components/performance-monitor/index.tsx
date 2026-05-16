import { useState, useEffect, useCallback, useRef } from "react";
import { DriverFactory } from "@/lib/database-driver";
import { useProjectStore } from "@/stores/project-store";
import { useHistoryStore } from "@/stores/history-store";
import { cn } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  Clock,
  Gauge,
  Loader2,
  Lock,
  Pause,
  Play,
  RefreshCw,
  Search,
  Table,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  ActivityRow,
  BloatRow,
  IndexUsageRow,
  LockRow,
  MonitorTab,
  TableStatRow,
} from "./types";
import { OverviewTab } from "./overview-tab";
import { ActivityTab } from "./activity-tab";
import { TableStatsTab } from "./table-stats-tab";
import { HistoryTab } from "./history-tab";
import { LocksTab } from "./locks-tab";
import { IndexesTab } from "./indexes-tab";
import { BloatTab } from "./bloat-tab";

export function PerformanceMonitor({ projectId }: { projectId: string }) {
  const projects = useProjectStore((s) => s.projects);
  const details = projects[projectId];
  const historyEntries = useHistoryStore((s) => s.entries);

  const [tab, setTab] = useState<MonitorTab>("overview");
  const [dbStats, setDbStats] = useState<[string, string][]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [tableStats, setTableStats] = useState<TableStatRow[]>([]);
  const [locks, setLocks] = useState<LockRow[]>([]);
  const [indexUsage, setIndexUsage] = useState<IndexUsageRow[]>([]);
  const [bloat, setBloat] = useState<BloatRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!details) return;
    setIsLoading(true);
    try {
      const driver = DriverFactory.getDriver(details.driver);

      const basePromises = Promise.allSettled([
        driver.loadDatabaseStats(projectId),
        driver.loadActivity(projectId),
        driver.loadTableStats(projectId),
      ]);

      const extraPromises = Promise.allSettled([
        driver.loadLocks ? driver.loadLocks(projectId) : Promise.resolve(undefined),
        driver.loadIndexUsage ? driver.loadIndexUsage(projectId) : Promise.resolve(undefined),
        driver.loadTableBloat ? driver.loadTableBloat(projectId) : Promise.resolve(undefined),
      ]);

      const [baseResults, extraResults] = await Promise.all([basePromises, extraPromises]);

      const [stats, act, tStats] = baseResults;
      const [lk, iu, bl] = extraResults;

      if (stats.status === "fulfilled") setDbStats(stats.value);
      if (act.status === "fulfilled") {
        setActivity(
          act.value.map((r) => ({
            pid: r[0],
            user: r[1],
            database: r[2],
            state: r[3],
            waitEventType: r[4],
            waitEvent: r[5],
            query: r[6],
            durationSec: r[7],
            backendType: r[8],
            clientAddr: r[9],
          }))
        );
      }
      if (tStats.status === "fulfilled") {
        setTableStats(
          tStats.value.map((r) => ({
            schema: r[0],
            table: r[1],
            seqScan: r[2],
            seqTupRead: r[3],
            idxScan: r[4],
            idxTupFetch: r[5],
            inserts: r[6],
            updates: r[7],
            deletes: r[8],
            liveTuples: r[9],
            deadTuples: r[10],
            lastVacuum: r[11],
            lastAutovacuum: r[12],
            lastAnalyze: r[13],
          }))
        );
      }
      if (lk.status === "fulfilled" && lk.value) {
        setLocks(
          lk.value.map((r) => ({
            pid: r[0],
            user: r[1],
            mode: r[2],
            locktype: r[3],
            status: r[4],
            relation: r[5],
            schema: r[6],
            query: r[7],
            duration: r[8],
            waitEvent: r[9],
          }))
        );
      }
      if (iu.status === "fulfilled" && iu.value) {
        setIndexUsage(
          iu.value.map((r) => ({
            schema: r[0],
            table: r[1],
            index: r[2],
            size: r[3],
            scans: r[4],
            tuplesRead: r[5],
            tuplesFetched: r[6],
            status: r[7],
            definition: r[8],
          }))
        );
      }
      if (bl.status === "fulfilled" && bl.value) {
        setBloat(
          bl.value.map((r) => ({
            schema: r[0],
            table: r[1],
            liveTuples: r[2],
            deadTuples: r[3],
            bloatPct: r[4],
            totalSize: r[5],
            lastVacuum: r[6],
            lastAutovacuum: r[7],
            lastAnalyze: r[8],
            lastAutoanalyze: r[9],
          }))
        );
      }
      setLastRefresh(new Date());
    } catch (e) {
      console.error("Performance monitor refresh failed:", e);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, details]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => void refresh(), 5000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, refresh]);

  const projectHistory = historyEntries.filter((e) => e.projectId === projectId);
  const avgTime = projectHistory.length > 0
    ? projectHistory.reduce((sum, e) => sum + e.executionTime, 0) / projectHistory.length
    : 0;
  const failedQueries = projectHistory.filter((e) => !e.success).length;
  const slowQueries = [...projectHistory].sort((a, b) => b.executionTime - a.executionTime).slice(0, 10);

  const unusedIndexCount = indexUsage.filter((i) => i.status === "unused").length;
  const tablesNeedingVacuum = bloat.filter((b) => parseFloat(b.bloatPct) > 10);
  const waitingLocks = locks.filter((l) => l.status === "waiting");

  const tabs: { id: MonitorTab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { id: "activity", label: "Activity", icon: <Activity className="h-3.5 w-3.5" /> },
    { id: "tables", label: "Table Stats", icon: <Table className="h-3.5 w-3.5" /> },
    { id: "history", label: "Query History", icon: <Clock className="h-3.5 w-3.5" /> },
    { id: "locks", label: "Locks", icon: <Lock className="h-3.5 w-3.5" /> },
    { id: "indexes", label: "Index Advisor", icon: <Search className="h-3.5 w-3.5" /> },
    { id: "bloat", label: "Bloat", icon: <Gauge className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="font-mono text-sm font-semibold">Performance Monitor</span>
          <span className="font-mono text-xs text-muted-foreground">
            {details?.database ?? projectId}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="font-mono text-[10px] text-muted-foreground">
              Refreshed at {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? "Pause auto-refresh" : "Start auto-refresh (5s)"}
          >
            {autoRefresh ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void refresh()} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b px-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 font-mono text-xs border-b-2 transition-colors",
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {tab === "overview" && (
          <OverviewTab
            dbStats={dbStats}
            projectHistory={projectHistory}
            avgTime={avgTime}
            failedQueries={failedQueries}
          />
        )}

        {tab === "activity" && <ActivityTab activity={activity} />}

        {tab === "tables" && <TableStatsTab tableStats={tableStats} />}

        {tab === "history" && <HistoryTab slowQueries={slowQueries} />}

        {tab === "locks" && <LocksTab locks={locks} waitingLocks={waitingLocks} />}

        {tab === "indexes" && (
          <IndexesTab indexUsage={indexUsage} unusedIndexCount={unusedIndexCount} />
        )}

        {tab === "bloat" && (
          <BloatTab bloat={bloat} tablesNeedingVacuum={tablesNeedingVacuum} />
        )}
      </div>
    </div>
  );
}
