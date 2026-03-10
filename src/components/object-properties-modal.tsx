import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  DraftColumn,
  DraftForeignKey,
  DraftIndex,
  DraftPrimaryKey,
  DraftUniqueConstraint,
  StructureEditorState,
} from "@/lib/alter-table-sql";
import {
  countChanges,
  FK_ACTIONS,
  generateAlterTableSQL,
  PG_COMMON_TYPES,
} from "@/lib/alter-table-sql";
import { DriverFactory } from "@/lib/database-driver";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/stores/project-store";
import { useTabStore } from "@/stores/tab-store";
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
  Pencil,
  Play,
  Plus,
  RefreshCw,
  ScrollText,
  Shield,
  Table,
  Trash2,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type ObjectType =
  | "table"
  | "view"
  | "matview"
  | "function"
  | "trigger-function";

type Tab =
  | "overview"
  | "columns"
  | "indexes"
  | "fkeys"
  | "ddl"
  | "actions"
  | "structure";

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
  const defaultTab: Tab =
    objectType === "table"
      ? "overview"
      : objectType === "function" || objectType === "trigger-function"
        ? "overview"
        : "overview";
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
  const [actionResult, setActionResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
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
  const pkCols = new Set(
    (idxs ?? []).filter((i) => i.isPrimary).map((i) => i.columnName),
  );

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
        const [statsResult, outFKResult, inFKResult] = await Promise.allSettled(
          [
            driver.loadTableStatistics?.(projectId, schema, name),
            driver.loadFKDetails?.(projectId, schema, name, "outgoing"),
            driver.loadFKDetails?.(projectId, schema, name, "incoming"),
          ],
        );

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

        const parseFKs = (
          result: PromiseSettledResult<
            | [
                string,
                string,
                string,
                string,
                string,
                string,
                string,
                string,
                string,
              ][]
            | undefined
          >,
        ) => {
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
      } else if (
        objectType === "function" ||
        objectType === "trigger-function"
      ) {
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
  }, [
    getDriver,
    objectType,
    projectId,
    schema,
    name,
    columnDetails,
    indexes,
    metaKey,
    storeLoadColumnDetails,
    storeLoadIndexes,
  ]);

  // Fetch DDL via backend
  const fetchDDL = useCallback(async () => {
    const driver = getDriver();
    if (!driver) return;

    setDdlLoading(true);
    setDdlError(null);
    setDdl(null);

    try {
      if (driver.generateDDL) {
        const result = await driver.generateDDL(
          projectId,
          schema,
          name,
          objectType,
        );
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

  const runAction = useCallback(
    async (actionLabel: string) => {
      const driver = getDriver();
      if (!driver?.tableAction) return;
      setActionLoading(true);
      setActionResult(null);
      try {
        const msg = await driver.tableAction(projectId, actionLabel, schema, name, objectType);
        setActionResult({ type: "success", message: msg });
        // Refresh stats
        void fetchLiveData();
      } catch (err: any) {
        setActionResult({
          type: "error",
          message: err?.message ?? "Action failed",
        });
      } finally {
        setActionLoading(false);
        setConfirmAction(null);
      }
    },
    [getDriver, projectId, fetchLiveData],
  );

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
    availableTabs.push({ key: "structure", label: "Structure" });
    availableTabs.push({
      key: "columns",
      label: `Columns${cols ? ` (${cols.length})` : ""}`,
    });
    availableTabs.push({
      key: "indexes",
      label: `Indexes${idxs ? ` (${new Set(idxs.map((i) => i.indexName)).size})` : ""}`,
    });
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
    structure: <Pencil className="h-3 w-3" />,
    ddl: <FileCode className="h-3 w-3" />,
    actions: <Zap className="h-3 w-3" />,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header with gradient accent */}
        <div
          className={cn(
            "relative px-5 pt-5 pb-3 bg-gradient-to-b",
            typeColor[objectType],
          )}
        >
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
                    {copied === "name" ? (
                      <Check className="h-3 w-3 text-success" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </DialogTitle>
                <DialogDescription className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-background/40 text-[10px] font-medium uppercase tracking-wider">
                    {objectLabel[objectType]}
                  </span>
                  <span className="font-mono text-[11px]">{schema}</span>
                  <span className="text-muted-foreground/30">|</span>
                  <span className="font-mono text-[11px] text-muted-foreground/60">
                    {projectId}
                  </span>
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
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tabIcons[tab.key]}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div
          className={cn(
            "flex-1 min-h-0 px-5 pb-5",
            activeTab === "ddl" || activeTab === "structure"
              ? "flex flex-col overflow-hidden"
              : "overflow-y-auto",
          )}
        >
          {activeTab === "structure" && objectType === "table" && (
            <StructureEditorContent
              projectId={projectId}
              schema={schema}
              tableName={name}
              cols={cols}
              idxs={idxs}
              cons={cons}
              outgoingFKs={outgoingFKs}
              getDriver={getDriver}
              onApplied={() => {
                void fetchLiveData();
                // Invalidate cached metadata so it re-fetches
                const store = useProjectStore.getState();
                const mk = metaKey;
                const newCols = { ...store.columnDetails };
                const newIdxs = { ...store.indexes };
                const newCons = { ...store.constraints };
                delete newCols[mk];
                delete newIdxs[mk];
                delete newCons[mk];
                useProjectStore.setState({
                  columnDetails: newCols,
                  indexes: newIdxs,
                  constraints: newCons,
                });
              }}
              openTab={openTab}
              onOpenChange={onOpenChange}
            />
          )}
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
          {activeTab === "indexes" && <IndexesContent idxs={idxs} />}
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
              setConfirmAction={(v) => {
                setConfirmAction(v);
                setConfirmInput("");
              }}
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
        <PropertySection
          title="View Definition"
          icon={<FileCode className="h-3.5 w-3.5" />}
        >
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
        <PropertySection
          title="Definition"
          icon={<FileCode className="h-3.5 w-3.5" />}
        >
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
          <StatCard
            label="Language"
            value={functionMeta.language}
            icon={<FileCode className="h-3.5 w-3.5" />}
          />
          <StatCard
            label="Volatility"
            value={functionMeta.volatility}
            icon={<RefreshCw className="h-3.5 w-3.5" />}
          />
          <StatCard
            label="Returns"
            value={functionMeta.returnType}
            icon={<ArrowRight className="h-3.5 w-3.5" />}
          />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono px-1">
          <InfoRow
            label="Security"
            value={
              functionMeta.securityDefiner
                ? "SECURITY DEFINER"
                : "SECURITY INVOKER"
            }
          />
          <InfoRow
            label="Strict"
            value={
              functionMeta.isStrict ? "YES (RETURNS NULL ON NULL INPUT)" : "NO"
            }
          />
          <InfoRow label="Est. Cost" value={functionMeta.estimatedCost} />
          <InfoRow label="Est. Rows" value={functionMeta.estimatedRows} />
        </div>
        {functionMeta.arguments && (
          <PropertySection
            title="Arguments"
            icon={<Columns3 className="h-3.5 w-3.5" />}
          >
            <div className="rounded-xl bg-[hsl(var(--background))] border border-border/30 px-3 py-2 text-[11px] font-mono text-foreground/90">
              {functionMeta.arguments}
            </div>
          </PropertySection>
        )}
        <PropertySection
          title="Source Code"
          icon={<FileCode className="h-3.5 w-3.5" />}
        >
          <div className="relative">
            <button
              onClick={() => copyText(functionMeta.source, "source")}
              className="absolute top-2 right-2 text-muted-foreground hover:text-foreground z-10"
              title="Copy source"
            >
              {copied === "source" ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
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
              <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest w-6">
                #
              </th>
              <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest w-8"></th>
              <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                Name
              </th>
              <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                Type
              </th>
              <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                Nullable
              </th>
              <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                Default
              </th>
            </tr>
          </thead>
          <tbody>
            {cols.map((c, i) => (
              <tr
                key={c.name}
                className="border-t border-border/15 hover:bg-primary/[0.04] transition-colors"
              >
                <td className="px-3 py-1.5 text-muted-foreground/30">
                  {i + 1}
                </td>
                <td className="px-3 py-1.5">
                  {pkCols.has(c.name) ? (
                    <Key className="h-3 w-3 text-warning" />
                  ) : (
                    <Columns3 className="h-3 w-3 text-muted-foreground/20" />
                  )}
                </td>
                <td className="px-3 py-1.5 text-foreground font-medium">
                  {c.name}
                </td>
                <td className="px-3 py-1.5">
                  <span className="text-primary/70 bg-primary/[0.06] px-1.5 py-0.5 rounded">
                    {c.dataType}
                  </span>
                </td>
                <td className="px-3 py-1.5">
                  {c.nullable ? (
                    <span className="text-muted-foreground/40">YES</span>
                  ) : (
                    <span className="text-orange-400/80 text-[10px] font-semibold">
                      NOT NULL
                    </span>
                  )}
                </td>
                <td
                  className="px-3 py-1.5 text-muted-foreground/60 max-w-[150px] truncate"
                  title={c.defaultValue ?? ""}
                >
                  {c.defaultValue ?? (
                    <span className="text-muted-foreground/20">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IndexesContent({ idxs }: { idxs?: import("@/types").IndexDetail[] }) {
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
              <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                Index Name
              </th>
              <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                Columns
              </th>
              <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                Type
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from(grouped.entries()).map(([idxName, entries]) => {
              const f = entries[0];
              return (
                <tr
                  key={idxName}
                  className="border-t border-border/15 hover:bg-primary/[0.04] transition-colors"
                >
                  <td className="px-3 py-2">
                    {f.isPrimary ? (
                      <Key className="h-3 w-3 text-warning" />
                    ) : f.isUnique ? (
                      <Shield className="h-3 w-3 text-blue-500" />
                    ) : (
                      <Key className="h-3 w-3 text-muted-foreground/25" />
                    )}
                  </td>
                  <td className="px-3 py-2 text-foreground font-medium">
                    {idxName}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground/70">
                    {entries.map((e) => e.columnName).join(", ")}
                  </td>
                  <td className="px-3 py-2">
                    {f.isPrimary ? (
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/20">
                        PRIMARY KEY
                      </span>
                    ) : f.isUnique ? (
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">
                        UNIQUE
                      </span>
                    ) : (
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground border border-border/30">
                        INDEX
                      </span>
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
        <PropertySection
          title="Outgoing (this table references)"
          icon={<ArrowRight className="h-3.5 w-3.5" />}
        >
          <div className="overflow-hidden rounded-xl border border-border/30 bg-muted/10">
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="bg-muted/30 border-b border-border/30">
                  <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                    Constraint
                  </th>
                  <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                    Column
                  </th>
                  <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                    References
                  </th>
                  <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                    ON DELETE
                  </th>
                  <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                    ON UPDATE
                  </th>
                </tr>
              </thead>
              <tbody>
                {outgoingFKs.map((fk, i) => (
                  <tr
                    key={i}
                    className="border-t border-border/15 hover:bg-primary/[0.04] transition-colors"
                  >
                    <td className="px-2 py-1.5 text-foreground">
                      {fk.constraintName}
                    </td>
                    <td className="px-2 py-1.5 text-primary/80">
                      {fk.sourceColumn}
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        className="text-blue-500 hover:underline"
                        onClick={() => {
                          openTab(
                            projectId,
                            `SELECT * FROM "${fk.targetSchema}"."${fk.targetTable}" LIMIT 100;`,
                          );
                          onOpenChange(false);
                        }}
                      >
                        {fk.targetSchema}.{fk.targetTable}.{fk.targetColumn}
                      </button>
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {fk.onDelete}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {fk.onUpdate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PropertySection>
      )}

      {incomingFKs.length > 0 && (
        <PropertySection
          title="Incoming (referenced by)"
          icon={<ArrowRight className="h-3.5 w-3.5 rotate-180" />}
        >
          <div className="overflow-hidden rounded-xl border border-border/30 bg-muted/10">
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="bg-muted/30 border-b border-border/30">
                  <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                    Constraint
                  </th>
                  <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                    From Table
                  </th>
                  <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                    Column
                  </th>
                  <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                    ON DELETE
                  </th>
                </tr>
              </thead>
              <tbody>
                {incomingFKs.map((fk, i) => (
                  <tr
                    key={i}
                    className="border-t border-border/15 hover:bg-primary/[0.04] transition-colors"
                  >
                    <td className="px-2 py-1.5 text-foreground">
                      {fk.constraintName}
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        className="text-blue-500 hover:underline"
                        onClick={() => {
                          openTab(
                            projectId,
                            `SELECT * FROM "${fk.sourceSchema}"."${fk.sourceTable}" LIMIT 100;`,
                          );
                          onOpenChange(false);
                        }}
                      >
                        {fk.sourceSchema}.{fk.sourceTable}
                      </button>
                    </td>
                    <td className="px-2 py-1.5 text-primary/80">
                      {fk.sourceColumn} &rarr; {fk.targetColumn}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {fk.onDelete}
                    </td>
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
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={onRetry}
        >
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
            <span className="text-[10px] font-mono text-muted-foreground/60">
              DDL
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 text-[10px] px-2 text-muted-foreground hover:text-foreground"
              onClick={onOpenInTab}
            >
              <Play className="h-2.5 w-2.5" />
              Open in Tab
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 text-[10px] px-2 text-muted-foreground hover:text-foreground"
              onClick={onCopy}
            >
              {copied === "ddl" ? (
                <>
                  <Check className="h-2.5 w-2.5 text-success" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-2.5 w-2.5" />
                  Copy
                </>
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
  runAction: (actionLabel: string) => Promise<void>;
  openTab: (projectId?: string, sql?: string) => void;
  projectId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const qualified = `"${schema}"."${name}"`;

  const actions: {
    label: string;
    icon: React.ReactNode;
    destructive?: boolean;
    confirm?: boolean;
    description: string;
  }[] = [];

  if (objectType === "table") {
    actions.push(
      { label: "ANALYZE", icon: <RefreshCw className="h-4 w-4" />, confirm: true, description: "Update table statistics for the query planner." },
      { label: "VACUUM", icon: <RefreshCw className="h-4 w-4" />, confirm: true, description: "Reclaim storage occupied by dead tuples." },
      { label: "VACUUM FULL", icon: <RefreshCw className="h-4 w-4" />, confirm: true, description: "Rewrite table to reclaim max space. Locks table exclusively." },
      { label: "REINDEX", icon: <Key className="h-4 w-4" />, confirm: true, description: "Rebuild all indexes on this table." },
      { label: "TRUNCATE", icon: <Trash2 className="h-4 w-4" />, destructive: true, confirm: true, description: "Remove all rows. Cannot be rolled back." },
      { label: "DROP TABLE", icon: <Trash2 className="h-4 w-4" />, destructive: true, confirm: true, description: "Permanently delete this table and all its data." },
    );
  } else if (objectType === "view") {
    actions.push(
      { label: "DROP VIEW", icon: <Trash2 className="h-4 w-4" />, destructive: true, confirm: true, description: "Permanently delete this view." },
      { label: "DROP VIEW CASCADE", icon: <Trash2 className="h-4 w-4" />, destructive: true, confirm: true, description: "Drop view and all dependent objects." },
    );
  } else if (objectType === "matview") {
    actions.push(
      { label: "REFRESH", icon: <RefreshCw className="h-4 w-4" />, confirm: true, description: "Refresh data by re-executing the query." },
      { label: "REFRESH CONCURRENTLY", icon: <RefreshCw className="h-4 w-4" />, confirm: true, description: "Refresh without locking reads. Requires a unique index." },
      { label: "DROP MATERIALIZED VIEW", icon: <Trash2 className="h-4 w-4" />, destructive: true, confirm: true, description: "Permanently delete this materialized view." },
    );
  } else if (objectType === "function" || objectType === "trigger-function") {
    actions.push(
      { label: "DROP FUNCTION", icon: <Trash2 className="h-4 w-4" />, destructive: true, confirm: true, description: "Permanently delete this function." },
      { label: "DROP FUNCTION CASCADE", icon: <Trash2 className="h-4 w-4" />, destructive: true, confirm: true, description: "Drop function and all dependent objects (triggers, etc.)." },
    );
  }

  return (
    <div className="space-y-3 py-3">
      {/* Quick open in tab */}
      {objectType === "table" && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Quick Queries
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => {
                openTab(projectId, `SELECT * FROM ${qualified} LIMIT 100;`);
                onOpenChange(false);
              }}
            >
              <Play className="h-3 w-3" /> SELECT TOP 100
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => {
                openTab(projectId, `SELECT COUNT(*) FROM ${qualified};`);
                onOpenChange(false);
              }}
            >
              <Play className="h-3 w-3" /> SELECT COUNT(*)
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => {
                openTab(
                  projectId,
                  `SELECT * FROM ${qualified} ORDER BY 1 DESC LIMIT 10;`,
                );
                onOpenChange(false);
              }}
            >
              <Play className="h-3 w-3" /> Latest 10
            </Button>
          </div>
        </div>
      )}

      {/* Action result */}
      {actionResult && (
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-md text-xs font-mono",
            actionResult.type === "success"
              ? "bg-success/10 text-success"
              : "bg-destructive/10 text-destructive",
          )}
        >
          {actionResult.type === "success" ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5" />
          )}
          {actionResult.message}
        </div>
      )}

      {/* Action buttons */}
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
        Maintenance & Operations
      </div>
      <div className="space-y-2">
        {actions.map((action) => (
          <div
            key={action.label}
            className={cn(
              "rounded-xl border bg-muted/10 transition-all",
              confirmAction === action.label
                ? "border-border/40 bg-muted/20"
                : "border-border/25 hover:border-border/40 hover:bg-muted/20",
            )}
          >
            <div className="flex items-center gap-3 px-3.5 py-3">
              <span
                className={cn(
                  "shrink-0",
                  action.destructive
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {action.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    "text-xs font-mono font-medium",
                    action.destructive && "text-destructive",
                  )}
                >
                  {action.label}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {action.description}
                </div>
              </div>
              {confirmAction !== action.label && (
                <Button
                  variant={action.destructive ? "ghost" : "outline"}
                  size="sm"
                  className={cn(
                    "h-7 px-3 text-xs shrink-0",
                    action.destructive &&
                      "text-destructive hover:bg-destructive/10",
                  )}
                  disabled={actionLoading}
                  onClick={() => {
                    if (action.confirm) {
                      setConfirmAction(action.label);
                    } else {
                      void runAction(action.label);
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
                    Type{" "}
                    <span className="font-mono font-semibold text-foreground">
                      {name}
                    </span>{" "}
                    to confirm
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
                    action.destructive
                      ? "text-destructive hover:bg-destructive/10"
                      : "text-foreground hover:bg-muted/50",
                  )}
                  disabled={actionLoading || confirmInput !== name}
                  onClick={() => void runAction(action.label)}
                >
                  {actionLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Confirm"
                  )}
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

type StructureSubTab = "columns" | "pk" | "fkeys" | "unique" | "indexes";

function uid() {
  return crypto.randomUUID();
}

function initStructureState(
  cols: import("@/types").ColumnDetail[] | undefined,
  idxs: import("@/types").IndexDetail[] | undefined,
  cons: import("@/types").ConstraintDetail[] | undefined,
  outgoingFKs: FKInfo[],
): StructureEditorState {
  const columns: DraftColumn[] = (cols ?? []).map((c) => ({
    _id: uid(),
    _status: "existing" as const,
    name: c.name,
    dataType: c.dataType,
    nullable: c.nullable,
    defaultValue: c.defaultValue,
    originalName: c.name,
    originalDataType: c.dataType,
    originalNullable: c.nullable,
    originalDefault: c.defaultValue,
  }));

  // Primary key from indexes
  const pkEntries = (idxs ?? []).filter((i) => i.isPrimary);
  const pkName = pkEntries[0]?.indexName ?? "";
  const primaryKey: DraftPrimaryKey | null =
    pkEntries.length > 0
      ? {
          constraintName: pkName,
          columns: pkEntries.map((e) => e.columnName),
          _status: "existing",
          originalColumns: pkEntries.map((e) => e.columnName),
        }
      : null;

  // Unique constraints from constraints
  const uniqueMap = new Map<string, string[]>();
  for (const c of cons ?? []) {
    if (c.constraintType === "UNIQUE") {
      const existing = uniqueMap.get(c.constraintName) ?? [];
      existing.push(c.columnName);
      uniqueMap.set(c.constraintName, existing);
    }
  }
  const uniqueConstraints: DraftUniqueConstraint[] = [
    ...uniqueMap.entries(),
  ].map(([name, ucCols]) => ({
    _id: uid(),
    _status: "existing" as const,
    constraintName: name,
    columns: ucCols,
  }));

  // Non-primary, non-unique indexes
  const idxMap = new Map<string, { columns: string[]; isUnique: boolean }>();
  for (const i of idxs ?? []) {
    if (i.isPrimary) continue;
    // Skip indexes that back a unique constraint
    if (uniqueMap.has(i.indexName)) continue;
    const existing = idxMap.get(i.indexName) ?? {
      columns: [],
      isUnique: i.isUnique,
    };
    existing.columns.push(i.columnName);
    idxMap.set(i.indexName, existing);
  }
  const indexes: DraftIndex[] = [...idxMap.entries()].map(([name, info]) => ({
    _id: uid(),
    _status: "existing" as const,
    indexName: name,
    columns: info.columns,
    isUnique: info.isUnique,
  }));

  // Foreign keys: group by constraintName
  const fkMap = new Map<string, FKInfo[]>();
  for (const fk of outgoingFKs) {
    const existing = fkMap.get(fk.constraintName) ?? [];
    existing.push(fk);
    fkMap.set(fk.constraintName, existing);
  }
  const foreignKeys: DraftForeignKey[] = [...fkMap.entries()].map(
    ([name, fks]) => ({
      _id: uid(),
      _status: "existing" as const,
      constraintName: name,
      sourceColumns: fks.map((f) => f.sourceColumn),
      targetSchema: fks[0].targetSchema,
      targetTable: fks[0].targetTable,
      targetColumns: fks.map((f) => f.targetColumn),
      onUpdate: fks[0].onUpdate,
      onDelete: fks[0].onDelete,
    }),
  );

  return { columns, primaryKey, foreignKeys, uniqueConstraints, indexes };
}

function StructureEditorContent({
  projectId,
  schema,
  tableName,
  cols,
  idxs,
  cons,
  outgoingFKs,
  getDriver,
  onApplied,
  openTab,
  onOpenChange,
}: {
  projectId: string;
  schema: string;
  tableName: string;
  cols: import("@/types").ColumnDetail[] | undefined;
  idxs: import("@/types").IndexDetail[] | undefined;
  cons: import("@/types").ConstraintDetail[] | undefined;
  outgoingFKs: FKInfo[];
  getDriver: () => ReturnType<typeof DriverFactory.getDriver> | null;
  onApplied: () => void;
  openTab: (projectId?: string, sql?: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [subTab, setSubTab] = useState<StructureSubTab>("columns");
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSql, setShowSql] = useState(false);

  // Build initial state
  const initialState = useMemo(
    () => initStructureState(cols, idxs, cons, outgoingFKs),
    [cols, idxs, cons, outgoingFKs],
  );
  const [draft, setDraft] = useState<StructureEditorState>(initialState);

  // Reset when initial state changes (e.g. modal re-opened)
  useEffect(() => {
    setDraft(initialState);
    setError(null);
    setShowSql(false);
  }, [initialState]);

  const changes = countChanges(draft);
  const activeColNames = draft.columns
    .filter((c) => c._status !== "removed")
    .map((c) => c.name);

  // Tables for FK target (from store)
  const tables = useProjectStore((s) => s.tables);
  const schemas = useProjectStore((s) => s.schemas);
  const loadTables = useProjectStore((s) => s.loadTables);
  const availableSchemas = schemas[projectId] ?? [];
  const getTablesForSchema = (s: string) =>
    (tables[`${projectId}::${s}`] ?? []).map((t) => t.name);

  // SQL preview
  const sqlStatements = useMemo(
    () => generateAlterTableSQL(schema, tableName, initialState, draft),
    [schema, tableName, initialState, draft],
  );
  const sqlPreview = sqlStatements.join("\n");

  // Apply changes
  const applyChanges = useCallback(async () => {
    const driver = getDriver();
    if (!driver || sqlStatements.length === 0) return;
    setApplying(true);
    setError(null);
    try {
      await driver.runQuery(projectId, "BEGIN");
      try {
        for (const stmt of sqlStatements) {
          await driver.runQuery(projectId, stmt);
        }
        await driver.runQuery(projectId, "COMMIT");
      } catch (err) {
        await driver.runQuery(projectId, "ROLLBACK").catch(() => {});
        throw err;
      }
      toast.success("Table structure updated");
      onApplied();
    } catch (err: any) {
      setError(err?.message ?? "Failed to apply changes");
    } finally {
      setApplying(false);
    }
  }, [getDriver, projectId, sqlStatements, onApplied]);

  // Column helpers
  const updateColumn = (id: string, updates: Partial<DraftColumn>) => {
    setDraft((prev) => ({
      ...prev,
      columns: prev.columns.map((c) => {
        if (c._id !== id) return c;
        const updated = { ...c, ...updates };
        // Mark as modified if it was existing and something changed
        if (c._status === "existing") {
          const changed =
            updated.name !== c.originalName ||
            updated.dataType !== c.originalDataType ||
            updated.nullable !== c.originalNullable ||
            updated.defaultValue !== c.originalDefault;
          updated._status = changed ? "modified" : "existing";
        }
        return updated;
      }),
    }));
  };

  const addColumn = () => {
    setDraft((prev) => ({
      ...prev,
      columns: [
        ...prev.columns,
        {
          _id: uid(),
          _status: "added",
          name: `new_column_${prev.columns.length + 1}`,
          dataType: "text",
          nullable: true,
          defaultValue: null,
        },
      ],
    }));
  };

  const removeColumn = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      columns: prev.columns
        .map((c) =>
          c._id === id
            ? c._status === "added"
              ? null
              : { ...c, _status: "removed" as const }
            : c,
        )
        .filter(Boolean) as DraftColumn[],
    }));
  };

  const restoreColumn = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      columns: prev.columns.map((c) =>
        c._id === id ? { ...c, _status: "existing" as const } : c,
      ),
    }));
  };

  // Sub-tab list
  const subTabs: { key: StructureSubTab; label: string }[] = [
    { key: "columns", label: "Columns" },
    { key: "pk", label: "Primary Key" },
    { key: "fkeys", label: "Foreign Keys" },
    { key: "unique", label: "Unique" },
    { key: "indexes", label: "Indexes" },
  ];

  if (!cols) return <LoadingPlaceholder />;

  return (
    <div className="flex-1 flex flex-col min-h-0 pt-2">
      {/* Sub-tab nav */}
      <div className="flex gap-0.5 bg-background/30 rounded-lg p-0.5 border border-border/20 shrink-0 mb-2">
        {subTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={cn(
              "px-2.5 py-1 text-[10px] font-medium rounded-md transition-all",
              subTab === t.key
                ? "bg-background text-foreground shadow-sm shadow-black/10"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {subTab === "columns" && (
          <div className="space-y-1">
            {/* Header */}
            <div className="grid grid-cols-[1fr_140px_70px_1fr_36px] gap-1.5 px-1 text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
              <span>Name</span>
              <span>Type</span>
              <span>Nullable</span>
              <span>Default</span>
              <span />
            </div>
            {draft.columns.map((col) => (
              <div
                key={col._id}
                className={cn(
                  "grid grid-cols-[1fr_140px_70px_1fr_36px] gap-1.5 items-center px-1 py-1 rounded-lg border transition-all",
                  col._status === "added" &&
                    "border-l-2 border-l-green-500 border-border/20 bg-green-500/5",
                  col._status === "modified" &&
                    "border-l-2 border-l-amber-500 border-border/20 bg-amber-500/5",
                  col._status === "removed" &&
                    "border-l-2 border-l-red-500 border-border/20 bg-red-500/5 opacity-50",
                  col._status === "existing" && "border-border/20",
                )}
              >
                <input
                  type="text"
                  value={col.name}
                  disabled={col._status === "removed"}
                  onChange={(e) =>
                    updateColumn(col._id, { name: e.target.value })
                  }
                  className="h-7 px-2 text-xs font-mono bg-background border border-border/30 rounded-md outline-none focus:border-primary/50 disabled:opacity-40"
                />
                <input
                  type="text"
                  value={col.dataType}
                  disabled={col._status === "removed"}
                  onChange={(e) =>
                    updateColumn(col._id, { dataType: e.target.value })
                  }
                  list="pg-types"
                  className="h-7 px-2 text-xs font-mono bg-background border border-border/30 rounded-md outline-none focus:border-primary/50 disabled:opacity-40"
                />
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={col.nullable}
                    disabled={col._status === "removed"}
                    onChange={(e) =>
                      updateColumn(col._id, { nullable: e.target.checked })
                    }
                    className="h-3.5 w-3.5 rounded border-border accent-primary"
                  />
                </div>
                <input
                  type="text"
                  value={col.defaultValue ?? ""}
                  disabled={col._status === "removed"}
                  onChange={(e) =>
                    updateColumn(col._id, {
                      defaultValue: e.target.value || null,
                    })
                  }
                  placeholder="NULL"
                  className="h-7 px-2 text-xs font-mono bg-background border border-border/30 rounded-md outline-none focus:border-primary/50 placeholder:text-muted-foreground/30 disabled:opacity-40"
                />
                <div className="flex justify-center">
                  {col._status === "removed" ? (
                    <button
                      onClick={() => restoreColumn(col._id)}
                      className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                      title="Restore"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => removeColumn(col._id)}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      title="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button
              onClick={addColumn}
              className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-lg transition-colors w-full"
            >
              <Plus className="h-3.5 w-3.5" /> Add Column
            </button>
            {/* HTML datalist for type suggestions */}
            <datalist id="pg-types">
              {PG_COMMON_TYPES.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
        )}

        {subTab === "pk" && (
          <div className="space-y-3 py-1">
            <div className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-1">
              Select columns for primary key
            </div>
            <div className="space-y-1">
              {activeColNames.map((colName) => {
                const isInPK =
                  draft.primaryKey?.columns.includes(colName) &&
                  draft.primaryKey._status !== "removed";
                return (
                  <label
                    key={colName}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border/20 cursor-pointer transition-all",
                      isInPK
                        ? "bg-primary/5 border-primary/20"
                        : "hover:bg-muted/20",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={!!isInPK}
                      onChange={() => {
                        setDraft((prev) => {
                          const currentCols =
                            prev.primaryKey?._status !== "removed"
                              ? (prev.primaryKey?.columns ?? [])
                              : [];
                          let newCols: string[];
                          if (currentCols.includes(colName)) {
                            newCols = currentCols.filter((c) => c !== colName);
                          } else {
                            newCols = [...currentCols, colName];
                          }
                          if (newCols.length === 0) {
                            // Remove PK
                            if (
                              prev.primaryKey &&
                              prev.primaryKey.originalColumns
                            ) {
                              return {
                                ...prev,
                                primaryKey: {
                                  ...prev.primaryKey,
                                  _status: "removed",
                                  columns: [],
                                },
                              };
                            }
                            return { ...prev, primaryKey: null };
                          }
                          const existingPK = prev.primaryKey;
                          const wasExisting =
                            existingPK?.originalColumns !== undefined;
                          const isSameAsOriginal =
                            wasExisting &&
                            JSON.stringify(newCols.sort()) ===
                              JSON.stringify(
                                [...(existingPK?.originalColumns ?? [])].sort(),
                              );
                          return {
                            ...prev,
                            primaryKey: {
                              constraintName:
                                existingPK?.constraintName ??
                                `${tableName}_pkey`,
                              columns: newCols,
                              _status: isSameAsOriginal
                                ? "existing"
                                : wasExisting
                                  ? "modified"
                                  : "added",
                              originalColumns: existingPK?.originalColumns,
                            },
                          };
                        });
                      }}
                      className="h-3.5 w-3.5 rounded border-border accent-primary"
                    />
                    <span className="text-xs font-mono">{colName}</span>
                    {isInPK && <Key className="h-3 w-3 text-primary ml-auto" />}
                  </label>
                );
              })}
            </div>
            {draft.primaryKey &&
              draft.primaryKey._status !== "removed" &&
              draft.primaryKey.columns.length > 0 && (
                <div className="text-[10px] text-muted-foreground px-1">
                  Constraint:{" "}
                  <span className="font-mono text-foreground">
                    {draft.primaryKey.constraintName}
                  </span>
                  {" — "}({draft.primaryKey.columns.join(", ")})
                </div>
              )}
          </div>
        )}

        {subTab === "fkeys" && (
          <div className="space-y-3 py-1">
            {draft.foreignKeys
              .filter((fk) => fk._status !== "removed")
              .map((fk) => (
                <FKCard
                  key={fk._id}
                  fk={fk}
                  activeColNames={activeColNames}
                  availableSchemas={availableSchemas}
                  getTablesForSchema={getTablesForSchema}
                  loadTables={loadTables}
                  projectId={projectId}
                  getDriver={getDriver}
                  onChange={(updates) => {
                    setDraft((prev) => ({
                      ...prev,
                      foreignKeys: prev.foreignKeys.map((f) =>
                        f._id === fk._id
                          ? {
                              ...f,
                              ...updates,
                              _status:
                                f._status === "existing"
                                  ? "existing"
                                  : f._status,
                            }
                          : f,
                      ),
                    }));
                  }}
                  onRemove={() => {
                    setDraft((prev) => ({
                      ...prev,
                      foreignKeys: prev.foreignKeys
                        .map((f) =>
                          f._id === fk._id
                            ? f._status === "added"
                              ? null
                              : { ...f, _status: "removed" as const }
                            : f,
                        )
                        .filter(Boolean) as DraftForeignKey[],
                    }));
                  }}
                />
              ))}
            {draft.foreignKeys
              .filter((fk) => fk._status === "removed")
              .map((fk) => (
                <div
                  key={fk._id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/5 opacity-60"
                >
                  <span className="text-xs font-mono line-through flex-1">
                    {fk.constraintName}
                  </span>
                  <button
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        foreignKeys: prev.foreignKeys.map((f) =>
                          f._id === fk._id
                            ? { ...f, _status: "existing" as const }
                            : f,
                        ),
                      }))
                    }
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    Restore
                  </button>
                </div>
              ))}
            <button
              onClick={() => {
                setDraft((prev) => ({
                  ...prev,
                  foreignKeys: [
                    ...prev.foreignKeys,
                    {
                      _id: uid(),
                      _status: "added",
                      constraintName: `${tableName}_fk_${prev.foreignKeys.length + 1}`,
                      sourceColumns: [],
                      targetSchema: schema,
                      targetTable: "",
                      targetColumns: [],
                      onUpdate: "NO ACTION",
                      onDelete: "NO ACTION",
                    },
                  ],
                }));
              }}
              className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-lg transition-colors w-full"
            >
              <Plus className="h-3.5 w-3.5" /> Add Foreign Key
            </button>
          </div>
        )}

        {subTab === "unique" && (
          <div className="space-y-3 py-1">
            {draft.uniqueConstraints
              .filter((uc) => uc._status !== "removed")
              .map((uc) => (
                <div
                  key={uc._id}
                  className={cn(
                    "rounded-xl border px-3.5 py-3 space-y-2",
                    uc._status === "added"
                      ? "border-green-500/20 bg-green-500/5"
                      : "border-border/25 bg-muted/10",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={uc.constraintName}
                      onChange={(e) => {
                        setDraft((prev) => ({
                          ...prev,
                          uniqueConstraints: prev.uniqueConstraints.map((u) =>
                            u._id === uc._id
                              ? { ...u, constraintName: e.target.value }
                              : u,
                          ),
                        }));
                      }}
                      className="flex-1 h-7 px-2 text-xs font-mono bg-background border border-border/30 rounded-md outline-none focus:border-primary/50"
                      placeholder="Constraint name"
                    />
                    <button
                      onClick={() => {
                        setDraft((prev) => ({
                          ...prev,
                          uniqueConstraints: prev.uniqueConstraints
                            .map((u) =>
                              u._id === uc._id
                                ? u._status === "added"
                                  ? null
                                  : { ...u, _status: "removed" as const }
                                : u,
                            )
                            .filter(Boolean) as DraftUniqueConstraint[],
                        }));
                      }}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-semibold">
                    Columns
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {activeColNames.map((colName) => {
                      const selected = uc.columns.includes(colName);
                      return (
                        <button
                          key={colName}
                          onClick={() => {
                            setDraft((prev) => ({
                              ...prev,
                              uniqueConstraints: prev.uniqueConstraints.map(
                                (u) => {
                                  if (u._id !== uc._id) return u;
                                  const newCols = selected
                                    ? u.columns.filter((c) => c !== colName)
                                    : [...u.columns, colName];
                                  return { ...u, columns: newCols };
                                },
                              ),
                            }));
                          }}
                          className={cn(
                            "px-2 py-0.5 text-[10px] font-mono rounded-md border transition-all",
                            selected
                              ? "bg-primary/10 border-primary/30 text-foreground"
                              : "border-border/20 text-muted-foreground hover:border-border/40",
                          )}
                        >
                          {colName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            {draft.uniqueConstraints
              .filter((uc) => uc._status === "removed")
              .map((uc) => (
                <div
                  key={uc._id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/5 opacity-60"
                >
                  <span className="text-xs font-mono line-through flex-1">
                    {uc.constraintName}
                  </span>
                  <button
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        uniqueConstraints: prev.uniqueConstraints.map((u) =>
                          u._id === uc._id
                            ? { ...u, _status: "existing" as const }
                            : u,
                        ),
                      }))
                    }
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    Restore
                  </button>
                </div>
              ))}
            <button
              onClick={() => {
                setDraft((prev) => ({
                  ...prev,
                  uniqueConstraints: [
                    ...prev.uniqueConstraints,
                    {
                      _id: uid(),
                      _status: "added",
                      constraintName: `${tableName}_unique_${prev.uniqueConstraints.length + 1}`,
                      columns: [],
                    },
                  ],
                }));
              }}
              className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-lg transition-colors w-full"
            >
              <Plus className="h-3.5 w-3.5" /> Add Unique Constraint
            </button>
          </div>
        )}

        {subTab === "indexes" && (
          <div className="space-y-3 py-1">
            {draft.indexes
              .filter((idx) => idx._status !== "removed")
              .map((idx) => (
                <div
                  key={idx._id}
                  className={cn(
                    "rounded-xl border px-3.5 py-3 space-y-2",
                    idx._status === "added"
                      ? "border-green-500/20 bg-green-500/5"
                      : "border-border/25 bg-muted/10",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={idx.indexName}
                      onChange={(e) => {
                        setDraft((prev) => ({
                          ...prev,
                          indexes: prev.indexes.map((i) =>
                            i._id === idx._id
                              ? { ...i, indexName: e.target.value }
                              : i,
                          ),
                        }));
                      }}
                      className="flex-1 h-7 px-2 text-xs font-mono bg-background border border-border/30 rounded-md outline-none focus:border-primary/50"
                      placeholder="Index name"
                    />
                    <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={idx.isUnique}
                        onChange={(e) => {
                          setDraft((prev) => ({
                            ...prev,
                            indexes: prev.indexes.map((i) =>
                              i._id === idx._id
                                ? { ...i, isUnique: e.target.checked }
                                : i,
                            ),
                          }));
                        }}
                        className="h-3 w-3 rounded border-border accent-primary"
                      />
                      Unique
                    </label>
                    <button
                      onClick={() => {
                        setDraft((prev) => ({
                          ...prev,
                          indexes: prev.indexes
                            .map((i) =>
                              i._id === idx._id
                                ? i._status === "added"
                                  ? null
                                  : { ...i, _status: "removed" as const }
                                : i,
                            )
                            .filter(Boolean) as DraftIndex[],
                        }));
                      }}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-semibold">
                    Columns
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {activeColNames.map((colName) => {
                      const selected = idx.columns.includes(colName);
                      return (
                        <button
                          key={colName}
                          onClick={() => {
                            setDraft((prev) => ({
                              ...prev,
                              indexes: prev.indexes.map((i) => {
                                if (i._id !== idx._id) return i;
                                const newCols = selected
                                  ? i.columns.filter((c) => c !== colName)
                                  : [...i.columns, colName];
                                return { ...i, columns: newCols };
                              }),
                            }));
                          }}
                          className={cn(
                            "px-2 py-0.5 text-[10px] font-mono rounded-md border transition-all",
                            selected
                              ? "bg-primary/10 border-primary/30 text-foreground"
                              : "border-border/20 text-muted-foreground hover:border-border/40",
                          )}
                        >
                          {colName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            {draft.indexes
              .filter((idx) => idx._status === "removed")
              .map((idx) => (
                <div
                  key={idx._id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/5 opacity-60"
                >
                  <span className="text-xs font-mono line-through flex-1">
                    {idx.indexName}
                  </span>
                  <button
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        indexes: prev.indexes.map((i) =>
                          i._id === idx._id
                            ? { ...i, _status: "existing" as const }
                            : i,
                        ),
                      }))
                    }
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    Restore
                  </button>
                </div>
              ))}
            <button
              onClick={() => {
                setDraft((prev) => ({
                  ...prev,
                  indexes: [
                    ...prev.indexes,
                    {
                      _id: uid(),
                      _status: "added",
                      indexName: `${tableName}_idx_${prev.indexes.length + 1}`,
                      columns: [],
                      isUnique: false,
                    },
                  ],
                }));
              }}
              className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-lg transition-colors w-full"
            >
              <Plus className="h-3.5 w-3.5" /> Add Index
            </button>
          </div>
        )}
      </div>

      {/* SQL preview panel */}
      {showSql && sqlStatements.length > 0 && (
        <div className="shrink-0 mt-2 rounded-xl border border-border/40 overflow-hidden bg-[hsl(var(--background))]">
          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b border-border/30">
            <span className="text-[10px] font-mono text-muted-foreground/60">
              SQL Preview
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 text-[10px] px-2 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  openTab(projectId, sqlPreview);
                  onOpenChange(false);
                }}
              >
                <Play className="h-2.5 w-2.5" /> Open in Tab
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 text-[10px] px-2 text-muted-foreground hover:text-foreground"
                onClick={() => navigator.clipboard.writeText(sqlPreview)}
              >
                <Copy className="h-2.5 w-2.5" /> Copy
              </Button>
            </div>
          </div>
          <pre className="p-3 text-[11px] font-mono text-foreground/90 overflow-y-auto whitespace-pre-wrap leading-relaxed max-h-[150px] selection:bg-primary/20">
            {sqlPreview}
          </pre>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="shrink-0 mt-2 flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 text-destructive text-xs font-mono">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="break-all">{error}</span>
        </div>
      )}

      {/* Bottom action bar */}
      {changes > 0 && (
        <div className="shrink-0 mt-2 flex items-center gap-2 pt-2 border-t border-border/20">
          <span className="text-[10px] font-medium text-muted-foreground">
            {changes} change{changes !== 1 ? "s" : ""}
          </span>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] text-muted-foreground"
            onClick={() => {
              setDraft(initialState);
              setError(null);
              setShowSql(false);
            }}
          >
            Discard
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => setShowSql((v) => !v)}
          >
            <FileCode className="h-3 w-3 mr-1" />
            {showSql ? "Hide SQL" : "Review SQL"}
          </Button>
          <Button
            size="sm"
            className="h-7 px-3 text-[11px]"
            disabled={applying || sqlStatements.length === 0}
            onClick={() => void applyChanges()}
          >
            {applying ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : null}
            Apply
          </Button>
        </div>
      )}
    </div>
  );
}

function FKCard({
  fk,
  activeColNames,
  availableSchemas,
  getTablesForSchema,
  loadTables,
  projectId,
  getDriver,
  onChange,
  onRemove,
}: {
  fk: DraftForeignKey;
  activeColNames: string[];
  availableSchemas: string[];
  getTablesForSchema: (schema: string) => string[];
  loadTables: (projectId: string, schema: string) => Promise<void>;
  projectId: string;
  getDriver: () => ReturnType<typeof DriverFactory.getDriver> | null;
  onChange: (updates: Partial<DraftForeignKey>) => void;
  onRemove: () => void;
}) {
  const [targetCols, setTargetCols] = useState<string[]>([]);

  // Load target table columns when target changes
  useEffect(() => {
    if (!fk.targetTable || !fk.targetSchema) {
      setTargetCols([]);
      return;
    }
    const driver = getDriver();
    if (!driver) return;
    driver
      .loadColumns(projectId, fk.targetSchema, fk.targetTable)
      .then(setTargetCols)
      .catch(() => setTargetCols([]));
  }, [fk.targetSchema, fk.targetTable, projectId, getDriver]);

  // Ensure tables are loaded for the selected schema
  useEffect(() => {
    if (fk.targetSchema) {
      loadTables(projectId, fk.targetSchema).catch(() => {});
    }
  }, [fk.targetSchema, projectId, loadTables]);

  const targetTableNames = getTablesForSchema(fk.targetSchema);

  return (
    <div
      className={cn(
        "rounded-xl border px-3.5 py-3 space-y-2.5",
        fk._status === "added"
          ? "border-green-500/20 bg-green-500/5"
          : "border-border/25 bg-muted/10",
      )}
    >
      {/* Name + delete */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={fk.constraintName}
          onChange={(e) => onChange({ constraintName: e.target.value })}
          className="flex-1 h-7 px-2 text-xs font-mono bg-background border border-border/30 rounded-md outline-none focus:border-primary/50"
          placeholder="Constraint name"
        />
        <button
          onClick={onRemove}
          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Target: schema + table */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-1">
            Target Schema
          </div>
          <select
            value={fk.targetSchema}
            onChange={(e) =>
              onChange({
                targetSchema: e.target.value,
                targetTable: "",
                targetColumns: [],
              })
            }
            className="w-full h-7 px-2 text-xs font-mono bg-background border border-border/30 rounded-md outline-none focus:border-primary/50"
          >
            {availableSchemas.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-1">
            Target Table
          </div>
          <select
            value={fk.targetTable}
            onChange={(e) =>
              onChange({ targetTable: e.target.value, targetColumns: [] })
            }
            className="w-full h-7 px-2 text-xs font-mono bg-background border border-border/30 rounded-md outline-none focus:border-primary/50"
          >
            <option value="">Select table...</option>
            {targetTableNames.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Column mapping: source → target (paired rows) */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Column Mapping</div>
        </div>
        <div className="space-y-1.5">
          <div className="grid grid-cols-[1fr_20px_1fr_28px] gap-1.5 text-[9px] text-muted-foreground/50 uppercase tracking-wider font-semibold px-0.5">
            <span>Source</span>
            <span />
            <span>Target</span>
            <span />
          </div>
          {fk.sourceColumns.map((srcCol, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_20px_1fr_28px] gap-1.5 items-center">
              <select
                value={srcCol}
                onChange={(e) => {
                  const newSrc = [...fk.sourceColumns];
                  newSrc[idx] = e.target.value;
                  onChange({ sourceColumns: newSrc });
                }}
                className="w-full h-7 px-2 text-xs font-mono bg-background border border-border/30 rounded-md outline-none focus:border-primary/50"
              >
                <option value="">Select...</option>
                {activeColNames.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ArrowRight className="h-3 w-3 text-muted-foreground/40 mx-auto" />
              <select
                value={fk.targetColumns[idx] ?? ""}
                onChange={(e) => {
                  const newTgt = [...fk.targetColumns];
                  newTgt[idx] = e.target.value;
                  onChange({ targetColumns: newTgt });
                }}
                disabled={!fk.targetTable || targetCols.length === 0}
                className="w-full h-7 px-2 text-xs font-mono bg-background border border-border/30 rounded-md outline-none focus:border-primary/50 disabled:opacity-40"
              >
                <option value="">Select...</option>
                {targetCols.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  const newSrc = fk.sourceColumns.filter((_, i) => i !== idx);
                  const newTgt = fk.targetColumns.filter((_, i) => i !== idx);
                  onChange({ sourceColumns: newSrc, targetColumns: newTgt });
                }}
                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive mx-auto"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              onChange({
                sourceColumns: [...fk.sourceColumns, ""],
                targetColumns: [...fk.targetColumns, ""],
              });
            }}
            className="flex items-center gap-1 px-1 py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3 w-3" /> Add column pair
          </button>
        </div>
      </div>

      {/* ON UPDATE / ON DELETE */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-1">
            On Update
          </div>
          <select
            value={fk.onUpdate}
            onChange={(e) => onChange({ onUpdate: e.target.value })}
            className="w-full h-7 px-2 text-xs font-mono bg-background border border-border/30 rounded-md outline-none focus:border-primary/50"
          >
            {FK_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-1">
            On Delete
          </div>
          <select
            value={fk.onDelete}
            onChange={(e) => onChange({ onDelete: e.target.value })}
            className="w-full h-7 px-2 text-xs font-mono bg-background border border-border/30 rounded-md outline-none focus:border-primary/50"
          >
            {FK_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/30 bg-gradient-to-br from-muted/40 to-muted/10 px-3 py-2.5 group hover:border-border/50 transition-colors",
        accent,
      )}
    >
      <div className="absolute top-0 right-0 w-12 h-12 bg-gradient-to-bl from-white/[0.02] to-transparent rounded-bl-full" />
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center h-6 w-6 rounded-md bg-background/50 text-muted-foreground shrink-0">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[9px] text-muted-foreground/60 uppercase tracking-widest font-medium">
            {label}
          </div>
          <div className="text-sm font-mono font-semibold text-foreground truncate leading-tight mt-0.5">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
      <span className="text-muted-foreground/70 text-[11px]">{label}</span>
      <span className="text-foreground text-[11px] font-medium text-right">
        {value}
      </span>
    </div>
  );
}

function PropertySection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center h-5 w-5 rounded-md bg-muted/40 text-muted-foreground/60">
          {icon}
        </div>
        <span className="text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-widest">
          {title}
        </span>
        <div className="flex-1 h-px bg-border/30" />
      </div>
      {children}
    </div>
  );
}

function ConstraintIcon({ type }: { type: string }) {
  if (type === "PRIMARY KEY")
    return <Key className="h-3 w-3 text-warning shrink-0" />;
  if (type === "FOREIGN KEY")
    return <Link2 className="h-3 w-3 text-blue-500 shrink-0" />;
  if (type === "UNIQUE")
    return <Shield className="h-3 w-3 text-blue-500 shrink-0" />;
  if (type === "CHECK")
    return <Check className="h-3 w-3 text-muted-foreground shrink-0" />;
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
