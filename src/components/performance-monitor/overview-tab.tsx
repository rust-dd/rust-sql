import { cn } from "@/lib/utils";
import { Database, HardDrive, Users, Zap } from "lucide-react";
import type { HistoryEntry } from "@/stores/history-store";

interface OverviewTabProps {
  dbStats: [string, string][];
  projectHistory: HistoryEntry[];
  avgTime: number;
  failedQueries: number;
}

export function OverviewTab({ dbStats, projectHistory, avgTime, failedQueries }: OverviewTabProps) {
  const statValue = (name: string) => dbStats.find(([n]) => n === name)?.[1] ?? "N/A";

  return (
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
