import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTabStore } from "@/stores/tab-store";
import { useProjectStore } from "@/stores/project-store";
import { Activity, Database, Plus, Terminal, X } from "lucide-react";

export function TabBar() {
  const tabs = useTabStore((s) => s.tabs);
  const selectedTabIndex = useTabStore((s) => s.selectedTabIndex);
  const selectTab = useTabStore((s) => s.selectTab);
  const closeTab = useTabStore((s) => s.closeTab);
  const openTab = useTabStore((s) => s.openTab);
  const openTerminalTab = useTabStore((s) => s.openTerminalTab);
  const projects = useProjectStore((s) => s.projects);

  return (
    <div className="flex items-center bg-card/40 backdrop-blur-md min-h-[40px] border-b border-border/40">
      <div className="flex flex-1 items-center overflow-x-auto overflow-y-hidden whitespace-nowrap scrollbar-none gap-0.5 px-1.5 py-1">
        {tabs.map((tab, idx) => {
          if (!tab) return null;
          const projectName = tab.projectId;
          const projectDb = tab.projectId
            ? projects[tab.projectId]?.database
            : undefined;
          const isActive = selectedTabIndex === idx;

          return (
            <div
              key={tab.id}
              onClick={() => selectTab(idx)}
              className={cn(
                "group flex shrink-0 items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-150 cursor-pointer select-none",
                isActive
                  ? "bg-accent/80 text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
              )}
            >
              <div className="flex items-center gap-1.5 font-mono text-xs">
                {tab.type === "terminal" ? (
                  <Terminal className={cn("h-3 w-3", isActive ? "text-primary" : "text-muted-foreground")} />
                ) : tab.type === "monitor" ? (
                  <Activity className={cn("h-3 w-3", isActive ? "text-primary" : "text-muted-foreground")} />
                ) : projectDb ? (
                  <Database className={cn("h-3 w-3", isActive ? "text-primary/70" : "text-muted-foreground/60")} />
                ) : null}
                {projectDb && tab.type !== "monitor" && (
                  <span className="text-muted-foreground/70">{projectName}:</span>
                )}
                <span className={cn(isActive && "font-medium")}>{tab.title}</span>
              </div>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(idx);
                  }}
                  className="opacity-0 transition-all hover:bg-destructive/20 hover:text-destructive rounded-md p-0.5 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-0.5 pr-1.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => openTab()}
          className="h-7 w-7 shrink-0 rounded-lg"
          title="New query tab"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={openTerminalTab}
          className="h-7 w-7 shrink-0 rounded-lg"
          title="Open terminal (Cmd+`)"
        >
          <Terminal className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
