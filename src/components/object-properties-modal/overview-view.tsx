import { Check, Database, Eye, FileCode, HardDrive, Shield } from "lucide-react";
import { LoadingPlaceholder, PropertySection, StatCard } from "./shared";
import type { MatViewStats, ViewInfo } from "./types";

export function ViewOverview({
  viewInfo,
  matViewStats,
}: {
  viewInfo?: ViewInfo | null;
  matViewStats?: MatViewStats | null;
}) {
  if (viewInfo !== undefined) {
    if (!viewInfo) return <LoadingPlaceholder />;
    return (
      <div className="space-y-4 py-3">
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            label="Updatable"
            value={viewInfo.isUpdatable}
            icon={<Eye className="h-3.5 w-3.5" />}
          />
          <StatCard
            label="Check Option"
            value={viewInfo.checkOption}
            icon={<Shield className="h-3.5 w-3.5" />}
          />
        </div>
        <PropertySection title="View Definition" icon={<FileCode className="h-3.5 w-3.5" />}>
          <pre className="rounded-xl bg-[hsl(var(--background))] border border-border/30 p-4 text-[11px] font-mono text-foreground/90 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[200px] selection:bg-primary/20">
            {viewInfo.definition}
          </pre>
        </PropertySection>
      </div>
    );
  }

  if (matViewStats !== undefined) {
    if (!matViewStats) return <LoadingPlaceholder />;
    return (
      <div className="space-y-4 py-3">
        <div className="grid grid-cols-3 gap-2">
          <StatCard
            label="Rows (est.)"
            value={Number(matViewStats.rowEstimate).toLocaleString()}
            icon={<Database className="h-3.5 w-3.5" />}
          />
          <StatCard
            label="Total Size"
            value={matViewStats.totalSize}
            icon={<HardDrive className="h-3.5 w-3.5" />}
          />
          <StatCard
            label="Populated"
            value={matViewStats.isPopulated}
            icon={<Check className="h-3.5 w-3.5" />}
          />
        </div>
        <PropertySection title="Definition" icon={<FileCode className="h-3.5 w-3.5" />}>
          <pre className="rounded-xl bg-[hsl(var(--background))] border border-border/30 p-4 text-[11px] font-mono text-foreground/90 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[200px] selection:bg-primary/20">
            {matViewStats.definition}
          </pre>
        </PropertySection>
      </div>
    );
  }

  return <LoadingPlaceholder />;
}
