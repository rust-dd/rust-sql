import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/stores/project-store";
import { useTabStore } from "@/stores/tab-store";
import { DriverFactory } from "@/lib/database-driver";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Columns3,
  Copy,
  Database,
  Eye,
  FileCode,
  HardDrive,
  Key,
  Layers,
  Link2,
  Loader2,
  Lock,
  Play,
  RefreshCw,
  ScrollText,
  Shield,
  Table,
  Trash2,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ObjectType = "table" | "view" | "matview" | "function" | "trigger-function";

type Tab = "overview" | "columns" | "indexes" | "fkeys" | "ddl" | "actions";

interface ObjectPropertiesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectType: ObjectType;
  projectId: string;
  schema: string;
  name: string;
}

interface TableStats {
  rowEstimate: string;
  tableSize: string;
  indexSize: string;
  totalSize: string;
  lastVacuum: string;
  lastAnalyze: string;
  lastAutoVacuum: string;
  lastAutoAnalyze: string;
  deadTuples: string;
  liveTuples: string;
  seqScan: string;
  idxScan: string;
}

interface FKInfo {
  constraintName: string;
  sourceSchema: string;
  sourceTable: string;
  sourceColumn: string;
  targetSchema: string;
  targetTable: string;
  targetColumn: string;
  onUpdate: string;
  onDelete: string;
}

interface ViewInfo {
  isUpdatable: string;
  checkOption: string;
  definition: string;
}

interface FunctionMeta {
  language: string;
  volatility: string;
  isStrict: boolean;
  securityDefiner: boolean;
  estimatedCost: string;
  estimatedRows: string;
  returnType: string;
  arguments: string;
  source: string;
}

interface MatViewStats {
  rowEstimate: string;
  totalSize: string;
  isPopulated: string;
  definition: string;
}

export function ObjectPropertiesModal({
  open,
  onOpenChange,
  objectType,
  projectId,
  schema,
  name,
}: ObjectPropertiesModalProps) {
  const defaultTab: Tab = objectType === "table" ? "overview" : objectType === "function" || objectType === "trigger-function" ? "overview" : "overview";
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);
  const [ddl, setDdl] = useState<string | null>(null);
  const [ddlLoading, setDdlLoading] = useState(false);
  const [ddlError, setDdlError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Live fetched data
  const [tableStats, setTableStats] = useState<TableStats | null>(null);
  const [outgoingFKs, setOutgoingFKs] = useState<FKInfo[]>([]);
  const [incomingFKs, setIncomingFKs] = useState<FKInfo[]>([]);
  const [viewInfo, setViewInfo] = useState<ViewInfo | null>(null);
  const [functionMeta, setFunctionMeta] = useState<FunctionMeta | null>(null);
  const [matViewStats, setMatViewStats] = useState<MatViewStats | null>(null);
  const [actionResult, setActionResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [confirmInput, setConfirmInput] = useState("");

  // Cached metadata from store
  const columnDetails = useProjectStore((s) => s.columnDetails);
  const indexes = useProjectStore((s) => s.indexes);
  const constraints = useProjectStore((s) => s.constraints);
  const triggers = useProjectStore((s) => s.triggers);
  const rules = useProjectStore((s) => s.rules);
  const policies = useProjectStore((s) => s.policies);
  const projects = useProjectStore((s) => s.projects);
  const storeLoadColumnDetails = useProjectStore((s) => s.loadColumnDetails);
  const storeLoadIndexes = useProjectStore((s) => s.loadIndexes);
  const openTab = useTabStore((s) => s.openTab);

  const metaKey = `${projectId}::${schema}::${name}`;
  const cols = columnDetails[metaKey];
  const idxs = indexes[metaKey];
  const cons = constraints[metaKey];
  const trigs = triggers[metaKey];
  const rls = rules[metaKey];
  const pols = policies[metaKey];
  const pkCols = new Set((idxs ?? []).filter((i) => i.isPrimary).map((i) => i.columnName));

  const getDriver = useCallback(() => {
    const d = projects[projectId];
    if (!d) return null;
    return DriverFactory.getDriver(d.driver);
  }, [projects, projectId]);

  // Fetch live data on open
  useEffect(() => {
    if (!open) return;
    setActiveTab(objectType === "table" ? "overview" : "overview");
    setDdl(null);
    setDdlError(null);
    setCopied(null);
    setActionResult(null);
    setConfirmAction(null);
    setTableStats(null);
    setOutgoingFKs([]);
    setIncomingFKs([]);
    setViewInfo(null);
    setFunctionMeta(null);
    setMatViewStats(null);

    void fetchLiveData();
  }, [open, objectType, projectId, schema, name]);

  const fetchLiveData = useCallback(async () => {
    const driver = getDriver();
    if (!driver) return;
    setLoading(true);

    try {
      if (objectType === "table") {
        const [statsResult, outFKResult, inFKResult] = await Promise.allSettled([
          driver.loadTableStatistics?.(projectId, schema, name),
          driver.loadFKDetails?.(projectId, schema, name, "outgoing"),
          driver.loadFKDetails?.(projectId, schema, name, "incoming"),
        ]);

        // Ensure columns & indexes are loaded (may already be cached)
        if (!columnDetails[metaKey]) {
          storeLoadColumnDetails(projectId, schema, name).catch(() => {});
        }
        if (!indexes[metaKey]) {
          storeLoadIndexes(projectId, schema, name).catch(() => {});
        }

        if (statsResult.status === "fulfilled" && statsResult.value) {
          const statsMap = Object.fromEntries(statsResult.value);
          setTableStats({
            rowEstimate: statsMap.row_estimate ?? "0",
            tableSize: statsMap.table_size ?? "-",
            indexSize: statsMap.index_size ?? "-",
            totalSize: statsMap.total_size ?? "-",
            lastVacuum: statsMap.last_vacuum ?? "never",
            lastAnalyze: statsMap.last_analyze ?? "never",
            lastAutoVacuum: statsMap.last_autovacuum ?? "never",
            lastAutoAnalyze: statsMap.last_autoanalyze ?? "never",
            deadTuples: statsMap.dead_tuples ?? "0",
            liveTuples: statsMap.live_tuples ?? "0",
            seqScan: statsMap.seq_scan ?? "0",
            idxScan: statsMap.idx_scan ?? "0",
          });
        }

        const parseFKs = (result: PromiseSettledResult<[string, string, string, string, string, string, string, string, string][] | undefined>) => {
          if (result.status !== "fulfilled" || !result.value) return [];
          return result.value.map((r) => ({
            constraintName: r[0],
            sourceSchema: r[1],
            sourceTable: r[2],
            sourceColumn: r[3],
            targetSchema: r[4],
            targetTable: r[5],
            targetColumn: r[6],
            onUpdate: r[7],
            onDelete: r[8],
          }));
        };
        setOutgoingFKs(parseFKs(outFKResult));
        setIncomingFKs(parseFKs(inFKResult));

      } else if (objectType === "view") {
        const info = await driver.loadViewInfo?.(projectId, schema, name);
        if (info) {
          const infoMap = Object.fromEntries(info);
          setViewInfo({
            isUpdatable: infoMap.is_updatable ?? "NO",
            checkOption: infoMap.check_option ?? "NONE",
            definition: infoMap.definition ?? "",
          });
        }

      } else if (objectType === "matview") {
        const info = await driver.loadMatviewInfo?.(projectId, schema, name);
        if (info) {
          const infoMap = Object.fromEntries(info);
          setMatViewStats({
            rowEstimate: infoMap.row_estimate ?? "0",
            totalSize: infoMap.total_size ?? "-",
            isPopulated: infoMap.is_populated ?? "NO",
            definition: infoMap.definition ?? "",
          });
        }

      } else if (objectType === "function" || objectType === "trigger-function") {
        const info = await driver.loadFunctionInfo?.(projectId, schema, name);
        if (info) {
          const infoMap = Object.fromEntries(info);
          setFunctionMeta({
            language: infoMap.language ?? "",
            volatility: infoMap.volatility ?? "",
            isStrict: infoMap.is_strict === "true",
            securityDefiner: infoMap.security_definer === "true",
            estimatedCost: infoMap.estimated_cost ?? "",
            estimatedRows: infoMap.estimated_rows ?? "",
            returnType: infoMap.return_type ?? "",
            arguments: infoMap.arguments ?? "",
            source: infoMap.source ?? "",
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch live data:", err);
    } finally {
      setLoading(false);
    }
  }, [getDriver, objectType, projectId, schema, name, columnDetails, indexes, metaKey, storeLoadColumnDetails, storeLoadIndexes]);

  // Fetch DDL via backend
  const fetchDDL = useCallback(async () => {
    const driver = getDriver();
    if (!driver) return;

    setDdlLoading(true);
    setDdlError(null);
    setDdl(null);

    try {
      if (driver.generateDDL) {
        const result = await driver.generateDDL(projectId, schema, name, objectType);
        setDdl(result || "No DDL available");
      }
    } catch (err: any) {
      setDdlError(err?.message ?? "Failed to fetch DDL");
    } finally {
      setDdlLoading(false);
    }
  }, [getDriver, objectType, projectId, schema, name]);

  useEffect(() => {
    if (open && activeTab === "ddl" && !ddl && !ddlLoading) {
      void fetchDDL();
    }
  }, [open, activeTab, ddl, ddlLoading, fetchDDL]);

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const runAction = useCallback(async (sql: string, successMsg: string) => {
    const driver = getDriver();
    if (!driver) return;
    setActionLoading(true);
    setActionResult(null);
    try {
      await driver.runQuery(projectId, sql);
      setActionResult({ type: "success", message: successMsg });
      // Refresh stats
      void fetchLiveData();
    } catch (err: any) {
      setActionResult({ type: "error", message: err?.message ?? "Action failed" });
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  }, [getDriver, projectId, fetchLiveData]);

  const objectIcon: Record<ObjectType, React.ReactNode> = {
    table: <Table className="h-4 w-4 text-primary" />,
    view: <Eye className="h-4 w-4 text-blue-500" />,
    matview: <Layers className="h-4 w-4 text-purple-500" />,
    function: <FileCode className="h-4 w-4 text-amber-500" />,
    "trigger-function": <Zap className="h-4 w-4 text-orange-500" />,
  };

  const objectLabel: Record<ObjectType, string> = {
    table: "Table",
    view: "View",
    matview: "Materialized View",
    function: "Function",
    "trigger-function": "Trigger Function",
  };

  // Build available tabs based on object type
  const availableTabs: { key: Tab; label: string }[] = [];
  availableTabs.push({ key: "overview", label: "Overview" });
  if (objectType === "table") {
    availableTabs.push({ key: "columns", label: `Columns${cols ? ` (${cols.length})` : ""}` });
    availableTabs.push({ key: "indexes", label: `Indexes${idxs ? ` (${new Set(idxs.map((i) => i.indexName)).size})` : ""}` });
    availableTabs.push({ key: "fkeys", label: `Foreign Keys` });
  }
  availableTabs.push({ key: "ddl", label: "DDL" });
  availableTabs.push({ key: "actions", label: "Actions" });

  const typeColor: Record<ObjectType, string> = {
    table: "from-primary/20 to-primary/5",
    view: "from-blue-500/20 to-blue-500/5",
    matview: "from-purple-500/20 to-purple-500/5",
    function: "from-amber-500/20 to-amber-500/5",
    "trigger-function": "from-orange-500/20 to-orange-500/5",
  };

  const tabIcons: Partial<Record<Tab, React.ReactNode>> = {
    overview: <Database className="h-3 w-3" />,
    columns: <Columns3 className="h-3 w-3" />,
    indexes: <Key className="h-3 w-3" />,
    fkeys: <Link2 className="h-3 w-3" />,
    ddl: <FileCode className="h-3 w-3" />,
    actions: <Zap className="h-3 w-3" />,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header with gradient accent */}
        <div className={cn("relative px-5 pt-5 pb-3 bg-gradient-to-b", typeColor[objectType])}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.03),transparent_70%)]" />
          <DialogHeader className="relative">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-background/60 backdrop-blur-sm border border-border/30">
                {objectIcon[objectType]}
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="flex items-center gap-2 text-base">
                  <span className="truncate">{name}</span>
                  <button
                    onClick={() => copyText(`"${schema}"."${name}"`, "name")}
                    className="text-muted-foreground/40 hover:text-foreground transition-colors shrink-0"
                    title="Copy qualified name"
                  >
                    {copied === "name" ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                  </button>
                </DialogTitle>
                <DialogDescription className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-background/40 text-[10px] font-medium uppercase tracking-wider">
                    {objectLabel[objectType]}
                  </span>
                  <span className="font-mono text-[11px]">{schema}</span>
                  <span className="text-muted-foreground/30">|</span>
                  <span className="font-mono text-[11px] text-muted-foreground/60">{projectId}</span>
                  {loading && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Tab switcher - pill style */}
          <div className="relative flex gap-0.5 mt-3 bg-background/30 backdrop-blur-sm rounded-lg p-0.5 border border-border/20">
            {availableTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium whitespace-nowrap rounded-md transition-all",
                  activeTab === tab.key
                    ? "bg-background text-foreground shadow-sm shadow-black/10"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tabIcons[tab.key]}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className={cn(
          "flex-1 min-h-0 px-5 pb-5",
          activeTab === "ddl" ? "flex flex-col overflow-hidden" : "overflow-y-auto"
        )}>
          {activeTab === "overview" && (
            <OverviewContent
              objectType={objectType}
              tableStats={tableStats}
              viewInfo={viewInfo}
              matViewStats={matViewStats}
              functionMeta={functionMeta}
              cons={cons}
              trigs={trigs}
              rls={rls}
              pols={pols}
              copyText={copyText}
              copied={copied}
            />
          )}
          {activeTab === "columns" && (
            <ColumnsContent cols={cols} pkCols={pkCols} />
          )}
          {activeTab === "indexes" && (
            <IndexesContent idxs={idxs} />
          )}
          {activeTab === "fkeys" && (
            <ForeignKeysContent
              outgoingFKs={outgoingFKs}
              incomingFKs={incomingFKs}
              openTab={openTab}
              projectId={projectId}
              onOpenChange={onOpenChange}
            />
          )}
          {activeTab === "ddl" && (
            <DDLContent
              ddl={ddl}
              ddlLoading={ddlLoading}
              ddlError={ddlError}
              copied={copied}
              onCopy={() => ddl && copyText(ddl, "ddl")}
              onRetry={fetchDDL}
              onOpenInTab={() => {
                if (ddl) {
                  openTab(projectId, ddl);
                  onOpenChange(false);
                }
              }}
            />
          )}
          {activeTab === "actions" && (
            <ActionsContent
              objectType={objectType}
              schema={schema}
              name={name}
              actionResult={actionResult}
              actionLoading={actionLoading}
              confirmAction={confirmAction}
              setConfirmAction={(v) => { setConfirmAction(v); setConfirmInput(""); }}
              confirmInput={confirmInput}
              setConfirmInput={setConfirmInput}
              runAction={runAction}
              openTab={openTab}
              projectId={projectId}
              onOpenChange={onOpenChange}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Overview ─── */

function OverviewContent({
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
          <StatCard label="Rows (est.)" value={Number(tableStats.rowEstimate).toLocaleString()} icon={<Database className="h-3.5 w-3.5" />} />
          <StatCard label="Table Size" value={tableStats.tableSize} icon={<HardDrive className="h-3.5 w-3.5" />} />
          <StatCard label="Total Size" value={tableStats.totalSize} icon={<HardDrive className="h-3.5 w-3.5" />} />
          <StatCard label="Index Size" value={tableStats.indexSize} icon={<Key className="h-3.5 w-3.5" />} />
          <StatCard label="Live Tuples" value={Number(tableStats.liveTuples).toLocaleString()} icon={<Check className="h-3.5 w-3.5 text-success" />} />
          <StatCard label="Dead Tuples" value={Number(tableStats.deadTuples).toLocaleString()} icon={<AlertTriangle className="h-3.5 w-3.5 text-warning" />} />
        </div>

        {/* Scan stats */}
        <PropertySection title="Scan Statistics" icon={<RefreshCw className="h-3.5 w-3.5" />}>
          <div className="grid grid-cols-2 gap-2">
            <div className="px-3 py-2 rounded-md bg-muted/30 text-xs font-mono">
              <div className="text-muted-foreground text-[10px] uppercase mb-0.5">Sequential Scans</div>
              <div className="text-foreground">{Number(tableStats.seqScan).toLocaleString()}</div>
            </div>
            <div className="px-3 py-2 rounded-md bg-muted/30 text-xs font-mono">
              <div className="text-muted-foreground text-[10px] uppercase mb-0.5">Index Scans</div>
              <div className="text-foreground">{Number(tableStats.idxScan).toLocaleString()}</div>
            </div>
          </div>
        </PropertySection>

        {/* Maintenance */}
        <PropertySection title="Maintenance" icon={<RefreshCw className="h-3.5 w-3.5" />}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono px-1">
            <InfoRow label="Last Vacuum" value={formatTimestamp(tableStats.lastVacuum)} />
            <InfoRow label="Last Auto Vacuum" value={formatTimestamp(tableStats.lastAutoVacuum)} />
            <InfoRow label="Last Analyze" value={formatTimestamp(tableStats.lastAnalyze)} />
            <InfoRow label="Last Auto Analyze" value={formatTimestamp(tableStats.lastAutoAnalyze)} />
          </div>
        </PropertySection>

        {/* Constraints summary */}
        {cons && cons.length > 0 && (
          <PropertySection title="Constraints" icon={<Link2 className="h-3.5 w-3.5" />}>
            <div className="space-y-1">
              {Array.from(new Set(cons.map((c) => c.constraintName))).map((cName) => {
                const f = cons.find((c) => c.constraintName === cName)!;
                const entries = cons.filter((c) => c.constraintName === cName);
                return (
                  <div key={cName} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/20 border border-border/20 text-xs font-mono">
                    <ConstraintIcon type={f.constraintType} />
                    <span className="text-foreground">{cName}</span>
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-muted/50 text-muted-foreground/70">{f.constraintType}</span>
                    <span className="text-muted-foreground">({entries.map((e) => e.columnName).join(", ")})</span>
                  </div>
                );
              })}
            </div>
          </PropertySection>
        )}

        {/* Triggers */}
        {trigs && trigs.length > 0 && (
          <PropertySection title="Triggers" icon={<Zap className="h-3.5 w-3.5" />}>
            <div className="space-y-1">
              {trigs.map((t) => (
                <div key={`${t.triggerName}-${t.event}`} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/20 border border-border/20 text-xs font-mono">
                  <Zap className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                  <span className="text-foreground">{t.triggerName}</span>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-muted/50 text-muted-foreground/70">{t.timing} {t.event}</span>
                </div>
              ))}
            </div>
          </PropertySection>
        )}

        {/* RLS */}
        {pols && pols.length > 0 && (
          <PropertySection title="RLS Policies" icon={<Lock className="h-3.5 w-3.5" />}>
            <div className="space-y-1">
              {pols.map((p) => (
                <div key={p.policyName} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/20 border border-border/20 text-xs font-mono">
                  <Lock className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                  <span className="text-foreground">{p.policyName}</span>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-muted/50 text-muted-foreground/70">{p.permissive} {p.command}</span>
                </div>
              ))}
            </div>
          </PropertySection>
        )}

        {/* Rules */}
        {rls && rls.length > 0 && (
          <PropertySection title="Rules" icon={<ScrollText className="h-3.5 w-3.5" />}>
            <div className="space-y-1">
              {rls.map((r) => (
                <div key={r.ruleName} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/20 border border-border/20 text-xs font-mono">
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
    if (!viewInfo) return <LoadingPlaceholder />;
    return (
      <div className="space-y-4 py-3">
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Updatable" value={viewInfo.isUpdatable} icon={<Eye className="h-3.5 w-3.5" />} />
          <StatCard label="Check Option" value={viewInfo.checkOption} icon={<Shield className="h-3.5 w-3.5" />} />
        </div>
        <PropertySection title="View Definition" icon={<FileCode className="h-3.5 w-3.5" />}>
          <pre className="rounded-xl bg-[hsl(var(--background))] border border-border/30 p-4 text-[11px] font-mono text-foreground/90 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[200px] selection:bg-primary/20">
            {viewInfo.definition}
          </pre>
        </PropertySection>
      </div>
    );
  }

  if (objectType === "matview") {
    if (!matViewStats) return <LoadingPlaceholder />;
    return (
      <div className="space-y-4 py-3">
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Rows (est.)" value={Number(matViewStats.rowEstimate).toLocaleString()} icon={<Database className="h-3.5 w-3.5" />} />
          <StatCard label="Total Size" value={matViewStats.totalSize} icon={<HardDrive className="h-3.5 w-3.5" />} />
          <StatCard label="Populated" value={matViewStats.isPopulated} icon={<Check className="h-3.5 w-3.5" />} />
        </div>
        <PropertySection title="Definition" icon={<FileCode className="h-3.5 w-3.5" />}>
          <pre className="rounded-xl bg-[hsl(var(--background))] border border-border/30 p-4 text-[11px] font-mono text-foreground/90 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[200px] selection:bg-primary/20">
            {matViewStats.definition}
          </pre>
        </PropertySection>
      </div>
    );
  }

  if (objectType === "function" || objectType === "trigger-function") {
    if (!functionMeta) return <LoadingPlaceholder />;
    return (
      <div className="space-y-4 py-3">
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Language" value={functionMeta.language} icon={<FileCode className="h-3.5 w-3.5" />} />
          <StatCard label="Volatility" value={functionMeta.volatility} icon={<RefreshCw className="h-3.5 w-3.5" />} />
          <StatCard label="Returns" value={functionMeta.returnType} icon={<ArrowRight className="h-3.5 w-3.5" />} />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono px-1">
          <InfoRow label="Security" value={functionMeta.securityDefiner ? "SECURITY DEFINER" : "SECURITY INVOKER"} />
          <InfoRow label="Strict" value={functionMeta.isStrict ? "YES (RETURNS NULL ON NULL INPUT)" : "NO"} />
          <InfoRow label="Est. Cost" value={functionMeta.estimatedCost} />
          <InfoRow label="Est. Rows" value={functionMeta.estimatedRows} />
        </div>
        {functionMeta.arguments && (
          <PropertySection title="Arguments" icon={<Columns3 className="h-3.5 w-3.5" />}>
            <div className="rounded-xl bg-[hsl(var(--background))] border border-border/30 px-3 py-2 text-[11px] font-mono text-foreground/90">
              {functionMeta.arguments}
            </div>
          </PropertySection>
        )}
        <PropertySection title="Source Code" icon={<FileCode className="h-3.5 w-3.5" />}>
          <div className="relative">
            <button
              onClick={() => copyText(functionMeta.source, "source")}
              className="absolute top-2 right-2 text-muted-foreground hover:text-foreground z-10"
              title="Copy source"
            >
              {copied === "source" ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <pre className="rounded-xl bg-[hsl(var(--background))] border border-border/30 p-4 text-[11px] font-mono text-foreground/90 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[250px] selection:bg-primary/20">
              {functionMeta.source}
            </pre>
          </div>
        </PropertySection>
      </div>
    );
  }

  return <LoadingPlaceholder />;
}

/* ─── Columns Tab ─── */

function ColumnsContent({
  cols,
  pkCols,
}: {
  cols?: import("@/types").ColumnDetail[];
  pkCols: Set<string>;
}) {
  if (!cols) {
    return <LoadingPlaceholder />;
  }

  return (
    <div className="pt-3">
      <div className="overflow-hidden rounded-xl border border-border/30 bg-muted/10">
        <table className="w-full text-[11px] font-mono">
          <thead>
            <tr className="bg-muted/30 border-b border-border/30">
              <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest w-6">#</th>
              <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest w-8"></th>
              <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">Name</th>
              <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">Type</th>
              <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">Nullable</th>
              <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">Default</th>
            </tr>
          </thead>
          <tbody>
            {cols.map((c, i) => (
              <tr key={c.name} className="border-t border-border/15 hover:bg-primary/[0.04] transition-colors">
                <td className="px-3 py-1.5 text-muted-foreground/30">{i + 1}</td>
                <td className="px-3 py-1.5">
                  {pkCols.has(c.name) ? (
                    <Key className="h-3 w-3 text-warning" />
                  ) : (
                    <Columns3 className="h-3 w-3 text-muted-foreground/20" />
                  )}
                </td>
                <td className="px-3 py-1.5 text-foreground font-medium">{c.name}</td>
                <td className="px-3 py-1.5"><span className="text-primary/70 bg-primary/[0.06] px-1.5 py-0.5 rounded">{c.dataType}</span></td>
                <td className="px-3 py-1.5">
                  {c.nullable ? (
                    <span className="text-muted-foreground/40">YES</span>
                  ) : (
                    <span className="text-orange-400/80 text-[10px] font-semibold">NOT NULL</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-muted-foreground/60 max-w-[150px] truncate" title={c.defaultValue ?? ""}>
                  {c.defaultValue ?? <span className="text-muted-foreground/20">-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Indexes Tab ─── */

function IndexesContent({
  idxs,
}: {
  idxs?: import("@/types").IndexDetail[];
}) {
  if (!idxs) {
    return <LoadingPlaceholder />;
  }

  if (idxs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
        <Key className="h-6 w-6 text-muted-foreground/30" />
        <span className="text-xs font-mono">No indexes found</span>
      </div>
    );
  }

  const grouped = new Map<string, import("@/types").IndexDetail[]>();
  for (const idx of idxs) {
    if (!grouped.has(idx.indexName)) grouped.set(idx.indexName, []);
    grouped.get(idx.indexName)!.push(idx);
  }

  return (
    <div className="pt-3">
      <div className="overflow-hidden rounded-xl border border-border/30 bg-muted/10">
        <table className="w-full text-[11px] font-mono">
          <thead>
            <tr className="bg-muted/30 border-b border-border/30">
              <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest w-8"></th>
              <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">Index Name</th>
              <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">Columns</th>
              <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">Type</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(grouped.entries()).map(([idxName, entries]) => {
              const f = entries[0];
              return (
                <tr key={idxName} className="border-t border-border/15 hover:bg-primary/[0.04] transition-colors">
                  <td className="px-3 py-2">
                    {f.isPrimary ? (
                      <Key className="h-3 w-3 text-warning" />
                    ) : f.isUnique ? (
                      <Shield className="h-3 w-3 text-blue-500" />
                    ) : (
                      <Key className="h-3 w-3 text-muted-foreground/25" />
                    )}
                  </td>
                  <td className="px-3 py-2 text-foreground font-medium">{idxName}</td>
                  <td className="px-3 py-2 text-muted-foreground/70">{entries.map((e) => e.columnName).join(", ")}</td>
                  <td className="px-3 py-2">
                    {f.isPrimary ? (
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/20">PRIMARY KEY</span>
                    ) : f.isUnique ? (
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">UNIQUE</span>
                    ) : (
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground border border-border/30">INDEX</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Foreign Keys Tab ─── */

function ForeignKeysContent({
  outgoingFKs,
  incomingFKs,
  openTab,
  projectId,
  onOpenChange,
}: {
  outgoingFKs: FKInfo[];
  incomingFKs: FKInfo[];
  openTab: (projectId?: string, sql?: string) => void;
  projectId: string;
  onOpenChange: (open: boolean) => void;
}) {
  if (outgoingFKs.length === 0 && incomingFKs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-8">
        No foreign key relationships found.
      </div>
    );
  }

  return (
    <div className="space-y-4 py-3">
      {outgoingFKs.length > 0 && (
        <PropertySection title="Outgoing (this table references)" icon={<ArrowRight className="h-3.5 w-3.5" />}>
          <div className="overflow-hidden rounded-xl border border-border/30 bg-muted/10">
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="bg-muted/30 border-b border-border/30">
                  <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">Constraint</th>
                  <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">Column</th>
                  <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">References</th>
                  <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">ON DELETE</th>
                  <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">ON UPDATE</th>
                </tr>
              </thead>
              <tbody>
                {outgoingFKs.map((fk, i) => (
                  <tr key={i} className="border-t border-border/15 hover:bg-primary/[0.04] transition-colors">
                    <td className="px-2 py-1.5 text-foreground">{fk.constraintName}</td>
                    <td className="px-2 py-1.5 text-primary/80">{fk.sourceColumn}</td>
                    <td className="px-2 py-1.5">
                      <button
                        className="text-blue-500 hover:underline"
                        onClick={() => {
                          openTab(projectId, `SELECT * FROM "${fk.targetSchema}"."${fk.targetTable}" LIMIT 100;`);
                          onOpenChange(false);
                        }}
                      >
                        {fk.targetSchema}.{fk.targetTable}.{fk.targetColumn}
                      </button>
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">{fk.onDelete}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{fk.onUpdate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PropertySection>
      )}

      {incomingFKs.length > 0 && (
        <PropertySection title="Incoming (referenced by)" icon={<ArrowRight className="h-3.5 w-3.5 rotate-180" />}>
          <div className="overflow-hidden rounded-xl border border-border/30 bg-muted/10">
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="bg-muted/30 border-b border-border/30">
                  <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">Constraint</th>
                  <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">From Table</th>
                  <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">Column</th>
                  <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">ON DELETE</th>
                </tr>
              </thead>
              <tbody>
                {incomingFKs.map((fk, i) => (
                  <tr key={i} className="border-t border-border/15 hover:bg-primary/[0.04] transition-colors">
                    <td className="px-2 py-1.5 text-foreground">{fk.constraintName}</td>
                    <td className="px-2 py-1.5">
                      <button
                        className="text-blue-500 hover:underline"
                        onClick={() => {
                          openTab(projectId, `SELECT * FROM "${fk.sourceSchema}"."${fk.sourceTable}" LIMIT 100;`);
                          onOpenChange(false);
                        }}
                      >
                        {fk.sourceSchema}.{fk.sourceTable}
                      </button>
                    </td>
                    <td className="px-2 py-1.5 text-primary/80">{fk.sourceColumn} &rarr; {fk.targetColumn}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{fk.onDelete}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PropertySection>
      )}
    </div>
  );
}

/* ─── DDL Tab ─── */

function DDLContent({
  ddl,
  ddlLoading,
  ddlError,
  copied,
  onCopy,
  onRetry,
  onOpenInTab,
}: {
  ddl: string | null;
  ddlLoading: boolean;
  ddlError: string | null;
  copied: string | null;
  onCopy: () => void;
  onRetry: () => void;
  onOpenInTab: () => void;
}) {
  if (ddlLoading) {
    return <LoadingPlaceholder />;
  }

  if (ddlError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
        <p className="text-sm text-destructive font-mono">{ddlError}</p>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onRetry}>
          <RefreshCw className="h-3 w-3" />
          Retry
        </Button>
      </div>
    );
  }

  if (!ddl) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
        <FileCode className="h-6 w-6 text-muted-foreground/30" />
        <span className="text-xs font-mono">No DDL available</span>
      </div>
    );
  }

  return (
    <div className="pt-3 flex-1 flex flex-col min-h-0">
      {/* Code editor style container */}
      <div className="rounded-xl border border-border/40 overflow-hidden bg-[hsl(var(--background))] flex-1 flex flex-col min-h-0">
        {/* Title bar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b border-border/30 shrink-0">
          <div className="flex items-center gap-2">
            <FileCode className="h-3 w-3 text-muted-foreground/50" />
            <span className="text-[10px] font-mono text-muted-foreground/60">DDL</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-6 gap-1 text-[10px] px-2 text-muted-foreground hover:text-foreground" onClick={onOpenInTab}>
              <Play className="h-2.5 w-2.5" />
              Open in Tab
            </Button>
            <Button variant="ghost" size="sm" className="h-6 gap-1 text-[10px] px-2 text-muted-foreground hover:text-foreground" onClick={onCopy}>
              {copied === "ddl" ? (
                <><Check className="h-2.5 w-2.5 text-success" />Copied</>
              ) : (
                <><Copy className="h-2.5 w-2.5" />Copy</>
              )}
            </Button>
          </div>
        </div>
        <pre className="p-4 text-[11px] font-mono text-foreground/90 overflow-y-auto whitespace-pre-wrap leading-relaxed selection:bg-primary/20 flex-1 min-h-0">
          {ddl}
        </pre>
      </div>
    </div>
  );
}

/* ─── Actions Tab ─── */

function ActionsContent({
  objectType,
  schema,
  name,
  actionResult,
  actionLoading,
  confirmAction,
  setConfirmAction,
  confirmInput,
  setConfirmInput,
  runAction,
  openTab,
  projectId,
  onOpenChange,
}: {
  objectType: ObjectType;
  schema: string;
  name: string;
  actionResult: { type: "success" | "error"; message: string } | null;
  actionLoading: boolean;
  confirmAction: string | null;
  setConfirmAction: (action: string | null) => void;
  confirmInput: string;
  setConfirmInput: (value: string) => void;
  runAction: (sql: string, successMsg: string) => Promise<void>;
  openTab: (projectId?: string, sql?: string) => void;
  projectId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const qualified = `"${schema}"."${name}"`;

  const actions: { label: string; icon: React.ReactNode; sql: string; successMsg: string; destructive?: boolean; confirm?: boolean; description: string }[] = [];

  if (objectType === "table") {
    actions.push(
      { label: "ANALYZE", icon: <RefreshCw className="h-4 w-4" />, sql: `ANALYZE ${qualified};`, successMsg: "ANALYZE completed successfully.", confirm: true, description: "Update table statistics for the query planner." },
      { label: "VACUUM", icon: <RefreshCw className="h-4 w-4" />, sql: `VACUUM ${qualified};`, successMsg: "VACUUM completed successfully.", confirm: true, description: "Reclaim storage occupied by dead tuples." },
      { label: "VACUUM FULL", icon: <RefreshCw className="h-4 w-4" />, sql: `VACUUM FULL ${qualified};`, successMsg: "VACUUM FULL completed.", confirm: true, description: "Rewrite table to reclaim max space. Locks table exclusively." },
      { label: "REINDEX", icon: <Key className="h-4 w-4" />, sql: `REINDEX TABLE ${qualified};`, successMsg: "REINDEX completed.", confirm: true, description: "Rebuild all indexes on this table." },
      { label: "TRUNCATE", icon: <Trash2 className="h-4 w-4" />, sql: `TRUNCATE TABLE ${qualified};`, successMsg: "Table truncated.", destructive: true, confirm: true, description: "Remove all rows. Cannot be rolled back." },
      { label: "DROP TABLE", icon: <Trash2 className="h-4 w-4" />, sql: `DROP TABLE ${qualified};`, successMsg: "Table dropped.", destructive: true, confirm: true, description: "Permanently delete this table and all its data." },
    );
  } else if (objectType === "view") {
    actions.push(
      { label: "DROP VIEW", icon: <Trash2 className="h-4 w-4" />, sql: `DROP VIEW ${qualified};`, successMsg: "View dropped.", destructive: true, confirm: true, description: "Permanently delete this view." },
      { label: "DROP VIEW CASCADE", icon: <Trash2 className="h-4 w-4" />, sql: `DROP VIEW ${qualified} CASCADE;`, successMsg: "View dropped with cascade.", destructive: true, confirm: true, description: "Drop view and all dependent objects." },
    );
  } else if (objectType === "matview") {
    actions.push(
      { label: "REFRESH", icon: <RefreshCw className="h-4 w-4" />, sql: `REFRESH MATERIALIZED VIEW ${qualified};`, successMsg: "Materialized view refreshed.", confirm: true, description: "Refresh data by re-executing the query." },
      { label: "REFRESH CONCURRENTLY", icon: <RefreshCw className="h-4 w-4" />, sql: `REFRESH MATERIALIZED VIEW CONCURRENTLY ${qualified};`, successMsg: "Concurrent refresh completed.", confirm: true, description: "Refresh without locking reads. Requires a unique index." },
      { label: "DROP MATERIALIZED VIEW", icon: <Trash2 className="h-4 w-4" />, sql: `DROP MATERIALIZED VIEW ${qualified};`, successMsg: "Materialized view dropped.", destructive: true, confirm: true, description: "Permanently delete this materialized view." },
    );
  } else if (objectType === "function" || objectType === "trigger-function") {
    actions.push(
      { label: "DROP FUNCTION", icon: <Trash2 className="h-4 w-4" />, sql: `DROP FUNCTION ${qualified};`, successMsg: "Function dropped.", destructive: true, confirm: true, description: "Permanently delete this function." },
      { label: "DROP FUNCTION CASCADE", icon: <Trash2 className="h-4 w-4" />, sql: `DROP FUNCTION ${qualified} CASCADE;`, successMsg: "Function dropped with cascade.", destructive: true, confirm: true, description: "Drop function and all dependent objects (triggers, etc.)." },
    );
  }

  return (
    <div className="space-y-3 py-3">
      {/* Quick open in tab */}
      {objectType === "table" && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">Quick Queries</div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5"
              onClick={() => { openTab(projectId, `SELECT * FROM ${qualified} LIMIT 100;`); onOpenChange(false); }}>
              <Play className="h-3 w-3" /> SELECT TOP 100
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5"
              onClick={() => { openTab(projectId, `SELECT COUNT(*) FROM ${qualified};`); onOpenChange(false); }}>
              <Play className="h-3 w-3" /> SELECT COUNT(*)
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5"
              onClick={() => { openTab(projectId, `SELECT * FROM ${qualified} ORDER BY 1 DESC LIMIT 10;`); onOpenChange(false); }}>
              <Play className="h-3 w-3" /> Latest 10
            </Button>
          </div>
        </div>
      )}

      {/* Action result */}
      {actionResult && (
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-md text-xs font-mono",
          actionResult.type === "success" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
        )}>
          {actionResult.type === "success" ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          {actionResult.message}
        </div>
      )}

      {/* Action buttons */}
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">Maintenance & Operations</div>
      <div className="space-y-2">
        {actions.map((action) => (
          <div key={action.label} className={cn(
            "rounded-xl border bg-muted/10 transition-all",
            confirmAction === action.label ? "border-border/40 bg-muted/20" : "border-border/25 hover:border-border/40 hover:bg-muted/20"
          )}>
            <div className="flex items-center gap-3 px-3.5 py-3">
              <span className={cn("shrink-0", action.destructive ? "text-destructive" : "text-muted-foreground")}>
                {action.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className={cn("text-xs font-mono font-medium", action.destructive && "text-destructive")}>
                  {action.label}
                </div>
                <div className="text-[11px] text-muted-foreground">{action.description}</div>
              </div>
              {confirmAction !== action.label && (
                <Button
                  variant={action.destructive ? "ghost" : "outline"}
                  size="sm"
                  className={cn(
                    "h-7 px-3 text-xs shrink-0",
                    action.destructive && "text-destructive hover:bg-destructive/10"
                  )}
                  disabled={actionLoading}
                  onClick={() => {
                    if (action.confirm) {
                      setConfirmAction(action.label);
                    } else {
                      void runAction(action.sql, action.successMsg);
                    }
                  }}
                >
                  Run
                </Button>
              )}
            </div>
            {confirmAction === action.label && (
              <div className="px-3.5 pb-3 flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    Type <span className="font-mono font-semibold text-foreground">{name}</span> to confirm
                  </span>
                  <input
                    type="text"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    placeholder={name}
                    autoFocus
                    className="flex-1 h-7 px-2 text-xs font-mono bg-background border border-border/40 rounded-md outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/30"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 px-3 text-[11px] font-medium",
                    action.destructive ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-muted/50"
                  )}
                  disabled={actionLoading || confirmInput !== name}
                  onClick={() => void runAction(action.sql, action.successMsg)}
                >
                  {actionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px] text-muted-foreground"
                  onClick={() => setConfirmAction(null)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Shared Components ─── */

function StatCard({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-border/30 bg-gradient-to-br from-muted/40 to-muted/10 px-3 py-2.5 group hover:border-border/50 transition-colors", accent)}>
      <div className="absolute top-0 right-0 w-12 h-12 bg-gradient-to-bl from-white/[0.02] to-transparent rounded-bl-full" />
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center h-6 w-6 rounded-md bg-background/50 text-muted-foreground shrink-0">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[9px] text-muted-foreground/60 uppercase tracking-widest font-medium">{label}</div>
          <div className="text-sm font-mono font-semibold text-foreground truncate leading-tight mt-0.5">{value}</div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
      <span className="text-muted-foreground/70 text-[11px]">{label}</span>
      <span className="text-foreground text-[11px] font-medium text-right">{value}</span>
    </div>
  );
}

function PropertySection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center h-5 w-5 rounded-md bg-muted/40 text-muted-foreground/60">
          {icon}
        </div>
        <span className="text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-widest">{title}</span>
        <div className="flex-1 h-px bg-border/30" />
      </div>
      {children}
    </div>
  );
}

function ConstraintIcon({ type }: { type: string }) {
  if (type === "PRIMARY KEY") return <Key className="h-3 w-3 text-warning shrink-0" />;
  if (type === "FOREIGN KEY") return <Link2 className="h-3 w-3 text-blue-500 shrink-0" />;
  if (type === "UNIQUE") return <Shield className="h-3 w-3 text-blue-500 shrink-0" />;
  if (type === "CHECK") return <Check className="h-3 w-3 text-muted-foreground shrink-0" />;
  return <Link2 className="h-3 w-3 text-muted-foreground/50 shrink-0" />;
}

function LoadingPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
        <Loader2 className="h-5 w-5 animate-spin relative" />
      </div>
      <span className="text-xs font-mono">Loading...</span>
    </div>
  );
}

function formatTimestamp(ts: string): string {
  if (ts === "never") return "never";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 2592000000) return `${Math.floor(diff / 86400000)}d ago`;
    return d.toLocaleDateString();
  } catch {
    return ts;
  }
}
