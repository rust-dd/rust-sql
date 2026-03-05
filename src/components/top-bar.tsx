import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { useProjectStore } from "@/stores/project-store";
import { useTabStore, useActiveTab } from "@/stores/tab-store";
import { useUIStore } from "@/stores/ui-store";
import { useQueryStore } from "@/stores/query-store";
import { ProjectConnectionStatus } from "@/types";
import { AlignLeft, Database, GitBranch, Moon, Play, Save, Sun } from "lucide-react";
import { format as formatSQL } from "sql-formatter";

export function TopBar({
  onExecute,
  onExplain,
}: {
  onExecute: () => void;
  onExplain: () => void;
}) {
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const projects = useProjectStore((s) => s.projects);
  const status = useProjectStore((s) => s.status);
  const selectedTabIndex = useTabStore((s) => s.selectedTabIndex);
  const activeTab = useActiveTab();
  const setProjectId = useTabStore((s) => s.setProjectId);
  const updateContent = useTabStore((s) => s.updateContent);
  const saveQueryAction = useQueryStore((s) => s.saveQuery);
  const activeProject = activeTab?.projectId;
  const activeProjectDetails = activeProject ? projects[activeProject] : undefined;

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const saveInputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    if (saveDialogOpen) {
      setTimeout(() => saveInputRef.current?.focus(), 100);
    }
  }, [saveDialogOpen]);

  const handleSaveSubmit = async () => {
    if (!activeProject || !activeProjectDetails || !saveTitle.trim()) return;
    await saveQueryAction(activeProject, activeProjectDetails.database, activeProjectDetails.driver, saveTitle.trim(), activeTab?.editorValue ?? "");
    setSaveTitle("");
    setSaveDialogOpen(false);
  };

  const formatQuery = () => {
    const sql = activeTab?.editorValue;
    if (!sql?.trim()) return;
    try {
      const formatted = formatSQL(sql, { language: "postgresql", tabWidth: 2, keywordCase: "upper" });
      updateContent(selectedTabIndex, formatted);
    } catch {
      // silently ignore formatting errors
    }
  };

  return (
    <>
      <div className="flex h-11 items-center justify-between border-b border-border/50 bg-card/80 backdrop-blur-xl px-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <span className="font-mono text-sm font-semibold">RSQL</span>
          </div>
          <div className="h-4 w-px bg-border/50" />
          {activeProject && activeProjectDetails && status[activeProject] === ProjectConnectionStatus.Connected ? (
            <div className="flex items-center gap-1.5 bg-accent rounded-full px-2.5 py-0.5 text-xs text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-success shadow-[0_0_6px_oklch(0.65_0.18_150)]" />
              <span className="font-mono">{activeProject}</span>
              <span className="text-muted-foreground/50">&bull;</span>
              <span>
                {activeProjectDetails.host}:{activeProjectDetails.port}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {Object.keys(projects).length > 0 ? (
                <select
                  className="bg-input border border-border/50 text-foreground font-mono text-xs rounded-lg px-2 py-1"
                  value={activeProject ?? ""}
                  onChange={(e) => {
                    if (e.target.value) {
                      setProjectId(selectedTabIndex, e.target.value);
                    }
                  }}
                >
                  <option value="">Select connection...</option>
                  {Object.entries(projects).map(([id, details]) => (
                    <option key={id} value={id}>
                      {id} ({details.database}){status[id] === ProjectConnectionStatus.Connected ? "" : " \u2022 disconnected"}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-muted-foreground">No connection</span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2"
            onClick={() => setSaveDialogOpen(true)}
            disabled={!activeProject || !activeTab?.editorValue?.trim()}
          >
            <Save className="h-4 w-4" />
            <span className="text-xs">Save</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2"
            onClick={formatQuery}
            disabled={!activeTab?.editorValue?.trim()}
          >
            <AlignLeft className="h-4 w-4" />
            <span className="text-xs">Format</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2"
            onClick={onExplain}
            disabled={!activeProject || activeTab?.isExecuting}
          >
            <GitBranch className="h-4 w-4" />
            <span className="text-xs">Explain</span>
          </Button>
          <Button
            variant="gradient"
            size="sm"
            className="h-8 gap-2"
            onClick={onExecute}
            disabled={!activeProject || activeTab?.isExecuting}
          >
            <Play className="h-4 w-4" />
            <span className="text-xs">Execute ({navigator.platform.includes("Mac") ? "\u2318" : "Ctrl"}+Enter)</span>
          </Button>
          <div className="h-4 w-px bg-border/50" />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:rotate-12 transition-all duration-200"
            onClick={toggleTheme}
          >
            {theme === "light" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Save Query Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Save Query</DialogTitle>
            <DialogDescription>Save the current query for quick access later.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSaveSubmit();
            }}
            className="space-y-4 mt-2"
          >
            <div className="space-y-2">
              <label className="font-mono text-xs text-muted-foreground">Query Name</label>
              <Input
                ref={saveInputRef}
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                placeholder="e.g. Active users report"
                required
              />
            </div>
            <div className="rounded-lg bg-muted/50 p-2 max-h-24 overflow-auto">
              <pre className="font-mono text-[11px] text-muted-foreground whitespace-pre-wrap">{activeTab?.editorValue?.slice(0, 300)}{(activeTab?.editorValue?.length ?? 0) > 300 ? "..." : ""}</pre>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setSaveDialogOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" variant="gradient" className="text-xs" disabled={!saveTitle.trim()}>
                <Save className="h-3.5 w-3.5 mr-1" />
                Save Query
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
