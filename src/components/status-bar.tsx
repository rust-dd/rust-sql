import { useActiveTab } from "@/stores/tab-store";
import { useProjectStore } from "@/stores/project-store";
import { useHistoryStore } from "@/stores/history-store";
import { ProjectConnectionStatus } from "@/types";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export function StatusBar() {
  const activeTab = useActiveTab();
  const projects = useProjectStore((s) => s.projects);
  const status = useProjectStore((s) => s.status);
  const historyCount = useHistoryStore((s) => s.entries.length);

  const projectId = activeTab?.projectId;
  const details = projectId ? projects[projectId] : undefined;
  const connStatus = projectId ? status[projectId] : undefined;
  const result = activeTab?.result;
  const isExecuting = activeTab?.isExecuting;

  return (
    <div className="flex h-6 items-center justify-between border-t border-border bg-card px-3 text-[11px] font-mono text-muted-foreground">
      <div className="flex items-center gap-2">
        {projectId && details ? (
          <>
            <div
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                connStatus === ProjectConnectionStatus.Connected && "bg-success",
                connStatus === ProjectConnectionStatus.Connecting && "bg-warning",
                connStatus === ProjectConnectionStatus.Failed && "bg-destructive",
                !connStatus && "bg-muted",
              )}
            />
            <span>{projectId}</span>
            <span className="text-muted-foreground/50">&bull;</span>
            <span>{details.database}</span>
          </>
        ) : (
          <span>No connection</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isExecuting ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Executing...</span>
          </>
        ) : result ? (
          <span>
            {result.rows.length.toLocaleString()} rows in {result.time.toFixed(0)}ms
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <span>{historyCount} queries in history</span>
      </div>
    </div>
  );
}
