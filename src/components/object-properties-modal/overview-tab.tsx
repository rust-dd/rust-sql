import {
  AlertTriangle,
  Check,
  Database,
  HardDrive,
  Key,
  Link2,
  Lock,
  RefreshCw,
  ScrollText,
  Zap,
} from "lucide-react";
import {
  ConstraintIcon,
  InfoRow,
  LoadingPlaceholder,
  PropertySection,
  StatCard,
  formatTimestamp,
} from "./shared";
import type {
  FunctionMeta,
  MatViewStats,
  ObjectType,
  TableStats,
  ViewInfo,
} from "./types";
import { FunctionOverview } from "./overview-function";
import { ViewOverview } from "./overview-view";

export function OverviewContent({
  objectType,
  tableStats,
  viewInfo,
  matViewStats,
  functionMeta,
  cons,
  trigs,
  rls,
  pols,
  copyText,
  copied,
}: {
  objectType: ObjectType;
  tableStats: TableStats | null;
  viewInfo: ViewInfo | null;
  matViewStats: MatViewStats | null;
  functionMeta: FunctionMeta | null;
  cons?: import("@/types").ConstraintDetail[];
  trigs?: import("@/types").TriggerDetail[];
  rls?: import("@/types").RuleDetail[];
  pols?: import("@/types").PolicyDetail[];
  copyText: (text: string, label: string) => void;
  copied: string | null;
}) {
  if (objectType === "table") {
    if (!tableStats) {
      return <LoadingPlaceholder />;
    }
    return (
      <div className="space-y-4 py-3">
        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard
            label="Rows (est.)"
            value={Number(tableStats.rowEstimate).toLocaleString()}
            icon={<Database className="h-3.5 w-3.5" />}
          />
          <StatCard
            label="Table Size"
            value={tableStats.tableSize}
            icon={<HardDrive className="h-3.5 w-3.5" />}
          />
          <StatCard
            label="Total Size"
            value={tableStats.totalSize}
            icon={<HardDrive className="h-3.5 w-3.5" />}
          />
          <StatCard
            label="Index Size"
            value={tableStats.indexSize}
            icon={<Key className="h-3.5 w-3.5" />}
          />
          <StatCard
            label="Live Tuples"
            value={Number(tableStats.liveTuples).toLocaleString()}
            icon={<Check className="h-3.5 w-3.5 text-success" />}
          />
          <StatCard
            label="Dead Tuples"
            value={Number(tableStats.deadTuples).toLocaleString()}
            icon={<AlertTriangle className="h-3.5 w-3.5 text-warning" />}
          />
        </div>

        {/* Scan stats */}
        <PropertySection
          title="Scan Statistics"
          icon={<RefreshCw className="h-3.5 w-3.5" />}
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="px-3 py-2 rounded-md bg-muted/30 text-xs font-mono">
              <div className="text-muted-foreground text-[10px] uppercase mb-0.5">
                Sequential Scans
              </div>
              <div className="text-foreground">
                {Number(tableStats.seqScan).toLocaleString()}
              </div>
            </div>
            <div className="px-3 py-2 rounded-md bg-muted/30 text-xs font-mono">
              <div className="text-muted-foreground text-[10px] uppercase mb-0.5">
                Index Scans
              </div>
              <div className="text-foreground">
                {Number(tableStats.idxScan).toLocaleString()}
              </div>
            </div>
          </div>
        </PropertySection>

        {/* Maintenance */}
        <PropertySection
          title="Maintenance"
          icon={<RefreshCw className="h-3.5 w-3.5" />}
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono px-1">
            <InfoRow
              label="Last Vacuum"
              value={formatTimestamp(tableStats.lastVacuum)}
            />
            <InfoRow
              label="Last Auto Vacuum"
              value={formatTimestamp(tableStats.lastAutoVacuum)}
            />
            <InfoRow
              label="Last Analyze"
              value={formatTimestamp(tableStats.lastAnalyze)}
            />
            <InfoRow
              label="Last Auto Analyze"
              value={formatTimestamp(tableStats.lastAutoAnalyze)}
            />
          </div>
        </PropertySection>

        {/* Constraints summary */}
        {cons && cons.length > 0 && (
          <PropertySection
            title="Constraints"
            icon={<Link2 className="h-3.5 w-3.5" />}
          >
            <div className="space-y-1">
              {Array.from(new Set(cons.map((c) => c.constraintName))).map(
                (cName) => {
                  const f = cons.find((c) => c.constraintName === cName)!;
                  const entries = cons.filter(
                    (c) => c.constraintName === cName,
                  );
                  return (
                    <div
                      key={cName}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/20 border border-border/20 text-xs font-mono"
                    >
                      <ConstraintIcon type={f.constraintType} />
                      <span className="text-foreground">{cName}</span>
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-muted/50 text-muted-foreground/70">
                        {f.constraintType}
                      </span>
                      <span className="text-muted-foreground">
                        ({entries.map((e) => e.columnName).join(", ")})
                      </span>
                    </div>
                  );
                },
              )}
            </div>
          </PropertySection>
        )}

        {/* Triggers */}
        {trigs && trigs.length > 0 && (
          <PropertySection
            title="Triggers"
            icon={<Zap className="h-3.5 w-3.5" />}
          >
            <div className="space-y-1">
              {trigs.map((t) => (
                <div
                  key={`${t.triggerName}-${t.event}`}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/20 border border-border/20 text-xs font-mono"
                >
                  <Zap className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                  <span className="text-foreground">{t.triggerName}</span>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-muted/50 text-muted-foreground/70">
                    {t.timing} {t.event}
                  </span>
                </div>
              ))}
            </div>
          </PropertySection>
        )}

        {/* RLS */}
        {pols && pols.length > 0 && (
          <PropertySection
            title="RLS Policies"
            icon={<Lock className="h-3.5 w-3.5" />}
          >
            <div className="space-y-1">
              {pols.map((p) => (
                <div
                  key={p.policyName}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/20 border border-border/20 text-xs font-mono"
                >
                  <Lock className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                  <span className="text-foreground">{p.policyName}</span>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-muted/50 text-muted-foreground/70">
                    {p.permissive} {p.command}
                  </span>
                </div>
              ))}
            </div>
          </PropertySection>
        )}

        {/* Rules */}
        {rls && rls.length > 0 && (
          <PropertySection
            title="Rules"
            icon={<ScrollText className="h-3.5 w-3.5" />}
          >
            <div className="space-y-1">
              {rls.map((r) => (
                <div
                  key={r.ruleName}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/20 border border-border/20 text-xs font-mono"
                >
                  <ScrollText className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                  <span className="text-foreground">{r.ruleName}</span>
                  <span className="text-muted-foreground">{r.event}</span>
                </div>
              ))}
            </div>
          </PropertySection>
        )}
      </div>
    );
  }

  if (objectType === "view") {
    return <ViewOverview viewInfo={viewInfo} />;
  }

  if (objectType === "matview") {
    return <ViewOverview matViewStats={matViewStats} />;
  }

  if (objectType === "function" || objectType === "trigger-function") {
    return (
      <FunctionOverview
        functionMeta={functionMeta}
        copyText={copyText}
        copied={copied}
      />
    );
  }

  return <LoadingPlaceholder />;
}
