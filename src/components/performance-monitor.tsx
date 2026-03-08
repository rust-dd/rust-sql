import { useState, useEffect, useCallback, useRef } from "react";
import { DriverFactory } from "@/lib/database-driver";
import { useProjectStore } from "@/stores/project-store";
import { useHistoryStore } from "@/stores/history-store";
import { cn } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  Clock,
  Database,
  HardDrive,
  Loader2,
  Lock,
  Pause,
  Play,
  RefreshCw,
  Search,
  Table,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActivityRow {
  pid: string;
  user: string;
  database: string;
  state: string;
  waitEventType: string;
  waitEvent: string;
  query: string;
  durationSec: string;
  backendType: string;
  clientAddr: string;
}

interface TableStatRow {
  schema: string;
  table: string;
  seqScan: string;
  seqTupRead: string;
  idxScan: string;
  idxTupFetch: string;
  inserts: string;
  updates: string;
  deletes: string;
  liveTuples: string;
  deadTuples: string;
  lastVacuum: string;
  lastAutovacuum: string;
  lastAnalyze: string;
}

interface LockRow {
  pid: string;
  lockType: string;
  database: string;
  relation: string;
  mode: string;
  granted: string;
  waitStart: string;
  query: string;
}

interface IndexUsageRow {
  schema: string;
  table: string;
  index: string;
  size: string;
  scans: string;
  tuplesRead: string;
  tuplesFetched: string;
}

interface BloatRow {
  schema: string;
  table: string;
  tableSize: string;
  deadTuples: string;
  liveTuples: string;
  bloatRatio: string;
  lastVacuum: string;
  lastAutovacuum: string;
}

type MonitorTab = "overview" | "activity" | "tables" | "history" | "locks" | "index-usage" | "bloat";

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
      const [stats, act, tStats, lk, iu, bl] = await Promise.allSettled([
        driver.loadDatabaseStats(projectId),
        driver.loadActivity(projectId),
        driver.loadTableStats(projectId),
        driver.loadLocks?.(projectId),
        driver.loadIndexUsage?.(projectId),
        driver.loadTableBloat?.(projectId),
      ]);

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
            lockType: r[1],
            database: r[2],
            relation: r[3],
            mode: r[4],
            granted: r[5],
            waitStart: r[6],
            query: r[7],
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
          }))
        );
      }
      if (bl.status === "fulfilled" && bl.value) {
        setBloat(
          bl.value.map((r) => ({
            schema: r[0],
            table: r[1],
            tableSize: r[2],
            deadTuples: r[3],
            liveTuples: r[4],
            bloatRatio: r[5],
            lastVacuum: r[6],
            lastAutovacuum: r[7],
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

  // Project-specific history
  const projectHistory = historyEntries.filter((e) => e.projectId === projectId);
  const avgTime = projectHistory.length > 0
    ? projectHistory.reduce((sum, e) => sum + e.executionTime, 0) / projectHistory.length
    : 0;
  const failedQueries = projectHistory.filter((e) => !e.success).length;
  const slowQueries = [...projectHistory].sort((a, b) => b.executionTime - a.executionTime).slice(0, 10);

  const statValue = (name: string) => dbStats.find(([n]) => n === name)?.[1] ?? "N/A";

  const tabs: { id: MonitorTab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { id: "activity", label: "Activity", icon: <Activity className="h-3.5 w-3.5" /> },
    { id: "tables", label: "Table Stats", icon: <Table className="h-3.5 w-3.5" /> },
    { id: "locks", label: "Locks", icon: <Lock className="h-3.5 w-3.5" /> },
    { id: "index-usage", label: "Index Usage", icon: <Search className="h-3.5 w-3.5" /> },
    { id: "bloat", label: "Bloat", icon: <Trash2 className="h-3.5 w-3.5" /> },
    { id: "history", label: "Query History", icon: <Clock className="h-3.5 w-3.5" /> },
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
          <div className="space-y-4">
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard icon={<Users className="h-4 w-4" />} label="Active Connections" value={statValue("Active Connections")} />
              <StatCard icon={<Database className="h-4 w-4" />} label="Database Size" value={statValue("Database Size")} />
              <StatCard icon={<Zap className="h-4 w-4" />} label="Cache Hit Ratio" value={statValue("Cache Hit Ratio")} />
              <StatCard icon={<HardDrive className="h-4 w-4" />} label="Deadlocks" value={statValue("Deadlocks")} />
            </div>

            {/* All stats table */}
            <div className="rounded-md border">
              <div className="border-b px-3 py-2">
                <span className="font-mono text-xs font-semibold">Database Statistics</span>
              </div>
              <div className="divide-y">
                {dbStats.map(([name, val]) => (
                  <div key={name} className="flex items-center justify-between px-3 py-1.5">
                    <span className="font-mono text-xs text-muted-foreground">{name}</span>
                    <span className="font-mono text-xs font-medium">{val}</span>
                  </div>
                ))}
                {dbStats.length === 0 && (
                  <div className="px-3 py-4 text-center font-mono text-xs text-muted-foreground">
                    No stats available
                  </div>
                )}
              </div>
            </div>

            {/* Session history summary */}
            <div className="rounded-md border">
              <div className="border-b px-3 py-2">
                <span className="font-mono text-xs font-semibold">Session Query Summary</span>
              </div>
              <div className="grid grid-cols-3 divide-x">
                <div className="p-3 text-center">
                  <div className="font-mono text-lg font-bold">{projectHistory.length}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">Total Queries</div>
                </div>
                <div className="p-3 text-center">
                  <div className="font-mono text-lg font-bold">{avgTime.toFixed(1)}ms</div>
                  <div className="font-mono text-[10px] text-muted-foreground">Avg Execution Time</div>
                </div>
                <div className="p-3 text-center">
                  <div className={cn("font-mono text-lg font-bold", failedQueries > 0 && "text-destructive")}>{failedQueries}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">Failed Queries</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "activity" && (
          <div className="rounded-md border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {["PID", "User", "State", "Duration", "Wait", "Backend", "Client", "Query"].map((h) => (
                      <th key={h} className="px-2 py-1.5 text-left font-mono text-[10px] font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {activity.map((row) => (
                    <tr key={row.pid} className="hover:bg-muted/30">
                      <td className="px-2 py-1 font-mono text-[11px]">{row.pid}</td>
                      <td className="px-2 py-1 font-mono text-[11px]">{row.user}</td>
                      <td className="px-2 py-1">
                        <span className={cn(
                          "inline-block rounded px-1.5 py-0.5 font-mono text-[10px]",
                          row.state === "active" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                          row.state === "idle" && "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
                          row.state === "idle in transaction" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                        )}>
                          {row.state}
                        </span>
                      </td>
                      <td className="px-2 py-1 font-mono text-[11px]">{parseFloat(row.durationSec).toFixed(1)}s</td>
                      <td className="px-2 py-1 font-mono text-[10px] text-muted-foreground">{row.waitEvent || "-"}</td>
                      <td className="px-2 py-1 font-mono text-[10px] text-muted-foreground">{row.backendType}</td>
                      <td className="px-2 py-1 font-mono text-[10px] text-muted-foreground">{row.clientAddr}</td>
                      <td className="max-w-[300px] truncate px-2 py-1 font-mono text-[10px] text-muted-foreground" title={row.query}>{row.query}</td>
                    </tr>
                  ))}
                  {activity.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center font-mono text-xs text-muted-foreground">No active connections</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "tables" && (
          <div className="space-y-2">
            <p className="font-mono text-[10px] text-muted-foreground px-1">
              Cumulative stats since server start or last pg_stat_reset(). Source: pg_stat_user_tables
            </p>
            <div className="rounded-md border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {["Schema", "Table", "Seq Scan", "Idx Scan", "Live Tuples", "Dead Tuples", "Inserts", "Updates", "Deletes", "Last Vacuum", "Last Analyze"].map((h) => (
                      <th key={h} className="px-2 py-1.5 text-left font-mono text-[10px] font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tableStats.map((row) => {
                    const deadRatio = parseInt(row.liveTuples) > 0
                      ? (parseInt(row.deadTuples) / parseInt(row.liveTuples)) * 100
                      : 0;
                    return (
                      <tr key={`${row.schema}.${row.table}`} className="hover:bg-muted/30">
                        <td className="px-2 py-1 font-mono text-[11px] text-muted-foreground">{row.schema}</td>
                        <td className="px-2 py-1 font-mono text-[11px] font-medium">{row.table}</td>
                        <td className="px-2 py-1 font-mono text-[11px]">{parseInt(row.seqScan).toLocaleString()}</td>
                        <td className="px-2 py-1 font-mono text-[11px]">{parseInt(row.idxScan).toLocaleString()}</td>
                        <td className="px-2 py-1 font-mono text-[11px]">{parseInt(row.liveTuples).toLocaleString()}</td>
                        <td className={cn("px-2 py-1 font-mono text-[11px]", deadRatio > 10 && "text-destructive font-medium")}>
                          {parseInt(row.deadTuples).toLocaleString()}
                          {deadRatio > 10 && <span className="ml-1 text-[9px]">({deadRatio.toFixed(0)}%)</span>}
                        </td>
                        <td className="px-2 py-1 font-mono text-[11px]">{parseInt(row.inserts).toLocaleString()}</td>
                        <td className="px-2 py-1 font-mono text-[11px]">{parseInt(row.updates).toLocaleString()}</td>
                        <td className="px-2 py-1 font-mono text-[11px]">{parseInt(row.deletes).toLocaleString()}</td>
                        <td className="px-2 py-1 font-mono text-[10px] text-muted-foreground whitespace-nowrap">{row.lastVacuum === "never" ? "never" : new Date(row.lastVacuum).toLocaleDateString()}</td>
                        <td className="px-2 py-1 font-mono text-[10px] text-muted-foreground whitespace-nowrap">{row.lastAnalyze === "never" ? "never" : new Date(row.lastAnalyze).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                  {tableStats.length === 0 && (
                    <tr>
                      <td colSpan={11} className="py-6 text-center font-mono text-xs text-muted-foreground">No table stats available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          </div>
        )}

        {tab === "locks" && (
          <div className="rounded-md border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {["PID", "Lock Type", "Database", "Relation", "Mode", "Granted", "Wait Start", "Query"].map((h) => (
                      <th key={h} className="px-2 py-1.5 text-left font-mono text-[10px] font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {locks.map((row, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="px-2 py-1 font-mono text-[11px]">{row.pid}</td>
                      <td className="px-2 py-1 font-mono text-[11px]">{row.lockType}</td>
                      <td className="px-2 py-1 font-mono text-[11px]">{row.database}</td>
                      <td className="px-2 py-1 font-mono text-[11px] font-medium">{row.relation}</td>
                      <td className="px-2 py-1">
                        <span className={cn(
                          "inline-block rounded px-1.5 py-0.5 font-mono text-[10px]",
                          row.mode.includes("Exclusive") && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                          row.mode.includes("Share") && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                          row.mode === "AccessShareLock" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                        )}>
                          {row.mode}
                        </span>
                      </td>
                      <td className="px-2 py-1">
                        <span className={cn(
                          "inline-block rounded px-1.5 py-0.5 font-mono text-[10px]",
                          row.granted === "true" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                        )}>
                          {row.granted === "true" ? "Yes" : "Waiting"}
                        </span>
                      </td>
                      <td className="px-2 py-1 font-mono text-[10px] text-muted-foreground whitespace-nowrap">{row.waitStart || "-"}</td>
                      <td className="max-w-[300px] truncate px-2 py-1 font-mono text-[10px] text-muted-foreground" title={row.query}>{row.query}</td>
                    </tr>
                  ))}
                  {locks.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center font-mono text-xs text-muted-foreground">No active locks</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "index-usage" && (
          <div className="space-y-2">
            <p className="font-mono text-[10px] text-muted-foreground px-1">
              Index usage statistics. Indexes with 0 scans may be candidates for removal.
            </p>
            <div className="rounded-md border">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {["Schema", "Table", "Index", "Size", "Scans", "Tuples Read", "Tuples Fetched"].map((h) => (
                        <th key={h} className="px-2 py-1.5 text-left font-mono text-[10px] font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {indexUsage.map((row, i) => {
                      const scans = parseInt(row.scans);
                      return (
                        <tr key={i} className="hover:bg-muted/30">
                          <td className="px-2 py-1 font-mono text-[11px] text-muted-foreground">{row.schema}</td>
                          <td className="px-2 py-1 font-mono text-[11px]">{row.table}</td>
                          <td className="px-2 py-1 font-mono text-[11px] font-medium">{row.index}</td>
                          <td className="px-2 py-1 font-mono text-[11px]">{row.size}</td>
                          <td className={cn("px-2 py-1 font-mono text-[11px]", scans === 0 && "text-destructive font-medium")}>
                            {scans.toLocaleString()}
                            {scans === 0 && <span className="ml-1 text-[9px]">unused</span>}
                          </td>
                          <td className="px-2 py-1 font-mono text-[11px]">{parseInt(row.tuplesRead).toLocaleString()}</td>
                          <td className="px-2 py-1 font-mono text-[11px]">{parseInt(row.tuplesFetched).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                    {indexUsage.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-6 text-center font-mono text-xs text-muted-foreground">No index data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === "bloat" && (
          <div className="space-y-2">
            <p className="font-mono text-[10px] text-muted-foreground px-1">
              Tables with high dead tuple ratios may benefit from VACUUM. Source: pg_stat_user_tables
            </p>
            <div className="rounded-md border">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {["Schema", "Table", "Table Size", "Live Tuples", "Dead Tuples", "Bloat Ratio", "Last Vacuum", "Last Autovacuum"].map((h) => (
                        <th key={h} className="px-2 py-1.5 text-left font-mono text-[10px] font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {bloat.map((row, i) => {
                      const ratio = parseFloat(row.bloatRatio);
                      return (
                        <tr key={i} className="hover:bg-muted/30">
                          <td className="px-2 py-1 font-mono text-[11px] text-muted-foreground">{row.schema}</td>
                          <td className="px-2 py-1 font-mono text-[11px] font-medium">{row.table}</td>
                          <td className="px-2 py-1 font-mono text-[11px]">{row.tableSize}</td>
                          <td className="px-2 py-1 font-mono text-[11px]">{parseInt(row.liveTuples).toLocaleString()}</td>
                          <td className={cn("px-2 py-1 font-mono text-[11px]", ratio > 10 && "text-destructive font-medium")}>
                            {parseInt(row.deadTuples).toLocaleString()}
                          </td>
                          <td className="px-2 py-1">
                            <div className="flex items-center gap-1.5">
                              <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all",
                                    ratio > 20 ? "bg-destructive" : ratio > 10 ? "bg-yellow-500" : "bg-green-500",
                                  )}
                                  style={{ width: `${Math.min(ratio, 100)}%` }}
                                />
                              </div>
                              <span className={cn("font-mono text-[11px]", ratio > 20 && "text-destructive font-medium")}>
                                {ratio.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-2 py-1 font-mono text-[10px] text-muted-foreground whitespace-nowrap">{row.lastVacuum === "never" ? "never" : new Date(row.lastVacuum).toLocaleDateString()}</td>
                          <td className="px-2 py-1 font-mono text-[10px] text-muted-foreground whitespace-nowrap">{row.lastAutovacuum === "never" ? "never" : new Date(row.lastAutovacuum).toLocaleDateString()}</td>
                        </tr>
                      );
                    })}
                    {bloat.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-6 text-center font-mono text-xs text-muted-foreground">No bloat data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-3">
            {/* Slow queries */}
            <div className="rounded-md border">
              <div className="border-b px-3 py-2">
                <span className="font-mono text-xs font-semibold">Slowest Queries (Session)</span>
              </div>
              <div className="divide-y">
                {slowQueries.map((q) => (
                  <div key={q.id} className="px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className={cn("font-mono text-[10px]", q.success ? "text-muted-foreground" : "text-destructive")}>
                        {new Date(q.timestamp).toLocaleTimeString()} - {q.success ? `${q.rowCount} rows` : "FAILED"}
                      </span>
                      <span className={cn("font-mono text-[11px] font-medium", q.executionTime > 1000 && "text-destructive")}>
                        {q.executionTime.toFixed(1)}ms
                      </span>
                    </div>
                    <pre className="mt-1 overflow-x-auto rounded bg-muted/50 p-1.5 font-mono text-[10px] text-foreground">
                      {q.sql.slice(0, 200)}{q.sql.length > 200 ? "..." : ""}
                    </pre>
                    {q.error && (
                      <div className="mt-1 font-mono text-[10px] text-destructive">{q.error}</div>
                    )}
                  </div>
                ))}
                {slowQueries.length === 0 && (
                  <div className="py-6 text-center font-mono text-xs text-muted-foreground">
                    No queries executed yet in this session
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="font-mono text-[10px]">{label}</span>
      </div>
      <div className="mt-1 font-mono text-lg font-bold">{value}</div>
    </div>
  );
}
