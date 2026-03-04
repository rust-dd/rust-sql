import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTabStore } from "@/stores/tab-store";
import { useProjectStore } from "@/stores/project-store";
import { Activity, Database, Plus, X } from "lucide-react";

export function TabBar() {
  const tabs = useTabStore((s) => s.tabs);
  const selectedTabIndex = useTabStore((s) => s.selectedTabIndex);
  const selectTab = useTabStore((s) => s.selectTab);
  const closeTab = useTabStore((s) => s.closeTab);
  const openTab = useTabStore((s) => s.openTab);
  const projects = useProjectStore((s) => s.projects);

  return (
    <div className="flex items-center border-b border-border bg-card">
      <div className="flex flex-1 items-center overflow-x-auto">
        {tabs.map((tab, idx) => {
          const projectName = tab.projectId;
          const projectDb = tab.projectId
            ? projects[tab.projectId]?.database
            : undefined;

          return (
            <div
              key={tab.id}
              className={cn(
                "group flex items-center gap-2 border-r border-border px-4 py-2.5 transition-colors",
                selectedTabIndex === idx
                  ? "bg-editor-bg text-foreground"
                  : "bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <button
                onClick={() => selectTab(idx)}
                className="flex items-center gap-1.5 font-mono text-xs"
              >
                {tab.type === "monitor" ? (
                  <Activity className="h-3 w-3 text-primary" />
                ) : projectDb ? (
                  <Database className="h-3 w-3 text-muted-foreground" />
                ) : null}
                {projectDb && tab.type !== "monitor" && (
                  <span className="text-muted-foreground">{projectName}:</span>
                )}
                <span>{tab.title}</span>
              </button>
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
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
