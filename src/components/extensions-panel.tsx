import { useState, useEffect, useCallback } from "react";
import { DriverFactory } from "@/lib/database-driver";
import { useProjectStore } from "@/stores/project-store";
import { cn } from "@/lib/utils";
import { ArrowUpCircle, Package, Loader2, RefreshCw, Download, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface Extension {
  name: string;
  installedVersion: string;
  defaultVersion: string;
  comment: string;
  schema: string;
}

interface AvailableExtension {
  name: string;
  version: string;
  comment: string;
}

export function ExtensionsPanel({ projectId }: { projectId: string }) {
  const projects = useProjectStore((s) => s.projects);
  const details = projects[projectId];

  const [installed, setInstalled] = useState<Extension[]>([]);
  const [available, setAvailable] = useState<AvailableExtension[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<"installed" | "available">("installed");

  const refresh = useCallback(async () => {
    if (!details) return;
    setIsLoading(true);
    try {
      const driver = DriverFactory.getDriver(details.driver);
      const [inst, avail] = await Promise.allSettled([
        driver.loadExtensions?.(projectId),
        driver.loadAvailableExtensions?.(projectId),
      ]);
      if (inst.status === "fulfilled" && inst.value) {
        setInstalled(inst.value.map((r) => ({
          name: r[0], installedVersion: r[1], defaultVersion: r[2], comment: r[3], schema: r[4],
        })));
      }
      if (avail.status === "fulfilled" && avail.value) {
        setAvailable(avail.value.map((r) => ({
          name: r[0], version: r[1], comment: r[2],
        })));
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId, details]);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDrop, setConfirmDrop] = useState<string | null>(null);
  const [confirmInstall, setConfirmInstall] = useState<string | null>(null);

  const execSQL = useCallback(async (sql: string, extName: string) => {
    if (!details) return;
    setBusy(extName);
    setError(null);
    try {
      const driver = DriverFactory.getDriver(details.driver);
      await driver.runQuery(projectId, sql);
      await refresh();
    } catch (err: any) {
      setError(`${extName}: ${err?.message ?? String(err)}`);
    } finally {
      setBusy(null);
    }
  }, [details, projectId, refresh]);

  const installExt = useCallback((name: string) => {
    setConfirmInstall(name);
  }, []);

  const confirmInstallExt = useCallback(() => {
    if (!confirmInstall) return;
    setConfirmInstall(null);
    void execSQL(`CREATE EXTENSION IF NOT EXISTS "${confirmInstall}";`, confirmInstall);
  }, [confirmInstall, execSQL]);

  const dropExt = useCallback((name: string) => {
    setConfirmDrop(name);
  }, []);

  const confirmDropExt = useCallback(() => {
    if (!confirmDrop) return;
    setConfirmDrop(null);
    void execSQL(`DROP EXTENSION IF EXISTS "${confirmDrop}" CASCADE;`, confirmDrop);
  }, [confirmDrop, execSQL]);

  const updateExt = useCallback((name: string) => {
    void execSQL(`ALTER EXTENSION "${name}" UPDATE;`, name);
  }, [execSQL]);

  useEffect(() => { void refresh(); }, [refresh]);

  const lowerFilter = filter.toLowerCase();
  const filteredInstalled = installed.filter((e) =>
    e.name.toLowerCase().includes(lowerFilter) || e.comment.toLowerCase().includes(lowerFilter)
  );
  const filteredAvailable = available.filter((e) =>
    e.name.toLowerCase().includes(lowerFilter) || e.comment.toLowerCase().includes(lowerFilter)
  );

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <span className="font-mono text-sm font-semibold">Extensions</span>
          <span className="font-mono text-xs text-muted-foreground">{details?.database ?? projectId}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void refresh()} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      </div>

      <div className="flex items-center gap-2 border-b px-4 py-2">
        <div className="flex gap-0">
          <button onClick={() => setTab("installed")} className={cn(
            "px-3 py-1.5 font-mono text-xs border-b-2 transition-colors",
            tab === "installed" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}>
            Installed ({installed.length})
          </button>
          <button onClick={() => setTab("available")} className={cn(
            "px-3 py-1.5 font-mono text-xs border-b-2 transition-colors",
            tab === "available" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}>
            Available ({available.length})
          </button>
        </div>
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter..."
          className="h-7 text-xs font-mono ml-auto w-48 bg-input/50"
        />
      </div>

      {error && (
        <div className="mx-4 mt-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2">
          <span className="font-mono text-xs text-destructive">{error}</span>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        {tab === "installed" && (
          <div className="space-y-2">
            {filteredInstalled.map((ext) => (
              <div key={ext.name} className="rounded-md border p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-green-500" />
                  <span className="font-mono text-sm font-medium">{ext.name}</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">{ext.installedVersion}</span>
                  {ext.defaultVersion && ext.defaultVersion !== ext.installedVersion && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 text-[10px] text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
                      onClick={() => updateExt(ext.name)}
                      disabled={busy === ext.name}
                    >
                      {busy === ext.name ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowUpCircle className="h-3 w-3" />}
                      Update to {ext.defaultVersion}
                    </Button>
                  )}
                  <span className="ml-auto flex items-center gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">{ext.schema}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => dropExt(ext.name)}
                      disabled={busy === ext.name}
                      title={`DROP EXTENSION "${ext.name}"`}
                    >
                      {busy === ext.name ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </Button>
                  </span>
                </div>
                {ext.comment && (
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">{ext.comment}</p>
                )}
              </div>
            ))}
            {filteredInstalled.length === 0 && (
              <div className="py-8 text-center font-mono text-xs text-muted-foreground">
                {filter ? "No matching extensions" : "No extensions installed"}
              </div>
            )}
          </div>
        )}

        {tab === "available" && (
          <div className="space-y-2">
            {filteredAvailable.map((ext) => (
              <div key={ext.name} className="rounded-md border p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-2">
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono text-sm font-medium">{ext.name}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{ext.version}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto h-6 gap-1 text-[10px]"
                    onClick={() => installExt(ext.name)}
                    disabled={busy === ext.name}
                  >
                    {busy === ext.name ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                    Install
                  </Button>
                </div>
                {ext.comment && (
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">{ext.comment}</p>
                )}
              </div>
            ))}
            {filteredAvailable.length === 0 && (
              <div className="py-8 text-center font-mono text-xs text-muted-foreground">
                {filter ? "No matching extensions" : "No available extensions"}
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={!!confirmInstall} onOpenChange={(open) => { if (!open) setConfirmInstall(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-mono">Install Extension</DialogTitle>
            <DialogDescription>
              Install <span className="font-mono font-semibold text-foreground">{confirmInstall}</span> into the current database?
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground">
            CREATE EXTENSION IF NOT EXISTS "{confirmInstall}";
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" className="text-xs" onClick={() => setConfirmInstall(null)}>Cancel</Button>
            <Button variant="gradient" className="text-xs" onClick={confirmInstallExt}>Install</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDrop} onOpenChange={(open) => { if (!open) setConfirmDrop(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-mono">Drop Extension</DialogTitle>
            <DialogDescription>
              Are you sure you want to drop <span className="font-mono font-semibold text-foreground">{confirmDrop}</span>?
              This will also drop all objects that depend on it (CASCADE).
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground">
            DROP EXTENSION IF EXISTS "{confirmDrop}" CASCADE;
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" className="text-xs" onClick={() => setConfirmDrop(null)}>Cancel</Button>
            <Button variant="outline" className="text-xs text-destructive border-destructive/50 hover:bg-destructive/10" onClick={confirmDropExt}>Drop Extension</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
