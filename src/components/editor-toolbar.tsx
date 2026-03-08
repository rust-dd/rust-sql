import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useProjectStore } from "@/stores/project-store";
import { useTabStore, useActiveTab } from "@/stores/tab-store";
import { useQueryStore } from "@/stores/query-store";
import { AlignLeft, GitBranch, Loader2, Play, Save } from "lucide-react";
import { format as formatSQL } from "sql-formatter";

export function EditorToolbar({
  onExecute,
  onExplain,
}: {
  onExecute: () => void;
  onExplain: () => void;
}) {
  const activeTab = useActiveTab();
  const selectedTabIndex = useTabStore((s) => s.selectedTabIndex);
  const updateContent = useTabStore((s) => s.updateContent);
  const projects = useProjectStore((s) => s.projects);
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

  // Only show for query tabs
  if (!activeTab || activeTab.type !== "query") return null;

  const hasContent = !!activeTab.editorValue?.trim();

  return (
    <>
      <div className="flex items-center gap-1 border-b border-border/40 bg-card/40 backdrop-blur-sm px-2 py-1 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs px-2"
          onClick={() => setSaveDialogOpen(true)}
          disabled={!activeProject || !hasContent}
        >
          <Save className="h-3.5 w-3.5" />
          Save
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs px-2"
          onClick={formatQuery}
          disabled={!hasContent}
        >
          <AlignLeft className="h-3.5 w-3.5" />
          Format
        </Button>

        <div className="h-4 w-px bg-border/40 mx-1" />

        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs px-2"
          onClick={onExplain}
          disabled={!activeProject || activeTab.isExecuting}
        >
          <GitBranch className="h-3.5 w-3.5" />
          Explain
          <kbd className="hidden sm:inline-flex ml-0.5 text-[10px] text-muted-foreground/60">
            {navigator.platform.includes("Mac") ? "\u2318" : "Ctrl"}+Shift+Enter
          </kbd>
        </Button>
        <Button
          variant="gradient"
          size="sm"
          className="h-7 gap-1.5 text-xs px-2.5"
          onClick={onExecute}
          disabled={!activeProject || activeTab.isExecuting}
        >
          {activeTab.isExecuting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          {activeTab.isExecuting ? "Running..." : "Execute"}
          {!activeTab.isExecuting && (
            <kbd className="hidden sm:inline-flex ml-0.5 text-[10px] text-white/60">
              {navigator.platform.includes("Mac") ? "\u2318" : "Ctrl"}+Enter
            </kbd>
          )}
        </Button>
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
