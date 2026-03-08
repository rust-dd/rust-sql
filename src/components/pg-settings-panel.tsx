import { useState, useEffect, useCallback, useMemo } from "react";
import { DriverFactory } from "@/lib/database-driver";
import { useProjectStore } from "@/stores/project-store";
import { cn } from "@/lib/utils";
import { Settings, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PgSetting {
  name: string;
  setting: string;
  unit: string;
  category: string;
  description: string;
  context: string;
  source: string;
  bootVal: string;
  resetVal: string;
}

export function PgSettingsPanel({ projectId }: { projectId: string }) {
  const projects = useProjectStore((s) => s.projects);
  const details = projects[projectId];

  const [settings, setSettings] = useState<PgSetting[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [contextFilter, setContextFilter] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!details) return;
    setIsLoading(true);
    try {
      const driver = DriverFactory.getDriver(details.driver);
      const result = await driver.loadPgSettings?.(projectId);
      if (result) {
        setSettings(result.map((r) => ({
          name: r[0], setting: r[1], unit: r[2], category: r[3],
          description: r[4], context: r[5], source: r[6], bootVal: r[7], resetVal: r[8],
        })));
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId, details]);

  useEffect(() => { void refresh(); }, [refresh]);

  const categories = useMemo(() => {
    const cats = new Set(settings.map((s) => s.category));
    return Array.from(cats).sort();
  }, [settings]);

  const lowerFilter = filter.toLowerCase();
  const filtered = settings.filter((s) => {
    if (categoryFilter && s.category !== categoryFilter) return false;
    if (contextFilter && s.context !== contextFilter) return false;
    if (lowerFilter && !s.name.toLowerCase().includes(lowerFilter) && !s.description.toLowerCase().includes(lowerFilter)) return false;
    return true;
  });

  // Group by category
  const grouped = new Map<string, PgSetting[]>();
  for (const s of filtered) {
    if (!grouped.has(s.category)) grouped.set(s.category, []);
    grouped.get(s.category)!.push(s);
  }

  const contextColor = (ctx: string) => {
    switch (ctx) {
      case "user": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "superuser": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "postmaster": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "sighup": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-primary" />
          <span className="font-mono text-sm font-semibold">PostgreSQL Settings</span>
          <span className="font-mono text-xs text-muted-foreground">{details?.database ?? projectId}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">{filtered.length}/{settings.length}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void refresh()} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b px-4 py-2 flex-wrap">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search settings..."
          className="h-7 text-xs font-mono w-56 bg-input/50"
        />
        <select
          value={categoryFilter ?? ""}
          onChange={(e) => setCategoryFilter(e.target.value || null)}
          className="h-7 rounded-md border bg-input/50 px-2 font-mono text-xs text-foreground"
        >
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={contextFilter ?? ""}
          onChange={(e) => setContextFilter(e.target.value || null)}
          className="h-7 rounded-md border bg-input/50 px-2 font-mono text-xs text-foreground"
        >
          <option value="">All contexts</option>
          <option value="user">user (SET)</option>
          <option value="superuser">superuser</option>
          <option value="sighup">sighup (reload)</option>
          <option value="postmaster">postmaster (restart)</option>
          <option value="internal">internal</option>
        </select>
        {(categoryFilter || contextFilter || filter) && (
          <button
            onClick={() => { setFilter(""); setCategoryFilter(null); setContextFilter(null); }}
            className="font-mono text-[10px] text-primary hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {Array.from(grouped.entries()).map(([category, items]) => (
          <div key={category}>
            <div className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm px-4 py-1.5 border-b border-border/30">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{category}</span>
            </div>
            <div className="divide-y divide-border/20">
              {items.map((s) => {
                const isModified = s.setting !== s.bootVal;
                return (
                  <div key={s.name} className={cn("px-4 py-2 hover:bg-muted/30 transition-colors", isModified && "bg-primary/[0.02]")}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-medium">{s.name}</span>
                      <span className={cn("rounded-full px-1.5 py-0.5 font-mono text-[9px]", contextColor(s.context))}>
                        {s.context}
                      </span>
                      {isModified && (
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] text-primary">modified</span>
                      )}
                      {s.source && s.source !== "default" && (
                        <span className="font-mono text-[9px] text-muted-foreground">via {s.source}</span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3">
                      <span className="font-mono text-sm font-bold text-foreground">
                        {s.setting}{s.unit ? ` ${s.unit}` : ""}
                      </span>
                      {isModified && (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          default: {s.bootVal}{s.unit ? ` ${s.unit}` : ""}
                        </span>
                      )}
                    </div>
                    {s.description && (
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{s.description}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-8 text-center font-mono text-xs text-muted-foreground">
            {filter || categoryFilter || contextFilter ? "No matching settings" : "No settings loaded"}
          </div>
        )}
      </div>
    </div>
  );
}
