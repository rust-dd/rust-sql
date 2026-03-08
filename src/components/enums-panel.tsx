import { useState, useEffect, useCallback } from "react";
import { DriverFactory } from "@/lib/database-driver";
import { useProjectStore } from "@/stores/project-store";
import { List, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface EnumType {
  schema: string;
  name: string;
  labels: string;
}

export function EnumsPanel({ projectId }: { projectId: string }) {
  const projects = useProjectStore((s) => s.projects);
  const details = projects[projectId];

  const [enums, setEnums] = useState<EnumType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState("");

  const refresh = useCallback(async () => {
    if (!details) return;
    setIsLoading(true);
    try {
      const driver = DriverFactory.getDriver(details.driver);
      const result = await driver.loadEnumTypes?.(projectId);
      if (result) {
        setEnums(result.map((r) => ({ schema: r[0], name: r[1], labels: r[2] })));
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId, details]);

  useEffect(() => { void refresh(); }, [refresh]);

  const lowerFilter = filter.toLowerCase();
  const filtered = enums.filter((e) =>
    e.name.toLowerCase().includes(lowerFilter) || e.labels.toLowerCase().includes(lowerFilter) || e.schema.toLowerCase().includes(lowerFilter)
  );

  // Group by schema
  const grouped = new Map<string, EnumType[]>();
  for (const e of filtered) {
    if (!grouped.has(e.schema)) grouped.set(e.schema, []);
    grouped.get(e.schema)!.push(e);
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <List className="h-4 w-4 text-primary" />
          <span className="font-mono text-sm font-semibold">Enum Types</span>
          <span className="font-mono text-xs text-muted-foreground">{details?.database ?? projectId}</span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter..."
            className="h-7 text-xs font-mono w-48 bg-input/50"
          />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void refresh()} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {Array.from(grouped.entries()).map(([schema, types]) => (
          <div key={schema} className="mb-4">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{schema}</div>
            <div className="space-y-2">
              {types.map((e) => (
                <div key={`${e.schema}.${e.name}`} className="rounded-md border p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <List className="h-3.5 w-3.5 text-primary/60" />
                    <span className="font-mono text-sm font-medium">{e.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {e.labels.split(", ").length} values
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {e.labels.split(", ").map((label) => (
                      <span
                        key={label}
                        className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-8 text-center font-mono text-xs text-muted-foreground">
            {filter ? "No matching enum types" : "No enum types found"}
          </div>
        )}
      </div>
    </div>
  );
}
