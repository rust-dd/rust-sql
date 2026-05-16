import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProjectDetails } from "@/types";

export function AddDatabaseDialog({
  open, onOpenChange, sourceProjectId, projects, onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceProjectId: string;
  projects: Record<string, ProjectDetails>;
  onAdd: (name: string, database: string) => Promise<void>;
}) {
  const [dbName, setDbName] = React.useState("");
  const [connName, setConnName] = React.useState("");
  const source = projects[sourceProjectId];

  React.useEffect(() => {
    if (open) { setDbName(""); setConnName(""); }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbName.trim()) return;
    void onAdd(connName.trim() || dbName.trim(), dbName.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="font-mono">Add Database</DialogTitle>
          <DialogDescription>
            Add a database to <span className="font-mono font-semibold text-foreground">{source?.host}:{source?.port}</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          <div className="space-y-1">
            <Label htmlFor="addDbName" className="font-mono text-xs">Database Name</Label>
            <Input
              id="addDbName"
              value={dbName}
              onChange={(e) => { setDbName(e.target.value); if (!connName) setConnName(""); }}
              placeholder="analytics_db"
              autoFocus
              className="font-mono text-sm h-8"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="addConnName" className="font-mono text-xs text-muted-foreground">Connection Name</Label>
            <Input
              id="addConnName"
              value={connName}
              onChange={(e) => setConnName(e.target.value)}
              placeholder={dbName || "optional"}
              className="font-mono text-sm h-8"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" className="text-xs" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="gradient" className="text-xs" disabled={!dbName.trim()}>Add</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
