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
    <div className="flex items-center border-b border-border bg-card min-h-[38px]">
      <div className="flex flex-1 items-center overflow-x-auto overflow-y-hidden whitespace-nowrap scrollbar-none">
        {tabs.map((tab, idx) => {
          if (!tab) return null;
          const projectName = tab.projectId;
          const projectDb = tab.projectId
            ? projects[tab.projectId]?.database
            : undefined;

          return (
            <div
              key={tab.id}
              onClick={() => selectTab(idx)}
              className={cn(
                "group flex shrink-0 items-center gap-2 border-r border-border px-4 py-2.5 transition-colors cursor-pointer select-none",
                selectedTabIndex === idx
                  ? "bg-editor-bg text-foreground"
                  : "bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <div className="flex items-center gap-1.5 font-mono text-xs">
                {tab.type === "terminal" ? (
                  <Terminal className="h-3 w-3 text-primary" />
                ) : tab.type === "monitor" ? (
                  <Activity className="h-3 w-3 text-primary" />
                ) : projectDb ? (
                  <Database className="h-3 w-3 text-muted-foreground" />
                ) : null}
                {projectDb && tab.type !== "monitor" && (
                  <span className="text-muted-foreground">{projectName}:</span>
                )}
                <span>{tab.title}</span>
              </div>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(idx);
                  }}
                  className="opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => openTab()}
        className="h-9 w-9 shrink-0"
        title="New query tab"
      >
        <Plus className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={openTerminalTab}
        className="h-9 w-9 shrink-0"
        title="Open terminal (Cmd+`)"
      >
        <Terminal className="h-4 w-4" />
      </Button>
    </div>
  );
}
