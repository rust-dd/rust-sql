import React from "react";
import { Button } from "@/components/ui/button";
import { ContextMenu, useContextMenu } from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/stores/project-store";
import { useUIStore } from "@/stores/ui-store";
import { useTabStore } from "@/stores/tab-store";
import { useQueryStore } from "@/stores/query-store";
import { ProjectConnectionStatus } from "@/types";
import {
  Activity,
  ChevronDown,
  ChevronRight,
  Columns3,
  Copy,
  Database,
  Edit3,
  Eye,
  FileCode,
  FileText,
  FolderOpen,
  Key,
  Layers,
  Link2,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  ScrollText,
  Server,
  Shield,
  Table,
  Trash2,
  X,
  Zap,
} from "lucide-react";

// Indent levels (px)
const I = { server: 4, db: 16, schema: 28, schemaObj: 36, table: 44, section: 52, item: 60 };

// DDL query generators
function ddlTableQuery(schema: string, table: string): string {
  return `-- Generate CREATE TABLE DDL for "${schema}"."${table}"
SELECT 'CREATE TABLE "' || schemaname || '"."' || tablename || '" (' || E'\\n' ||
  string_agg('  "' || column_name || '" ' || data_type ||
    CASE WHEN character_maximum_length IS NOT NULL THEN '(' || character_maximum_length || ')' ELSE '' END ||
    CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
    CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
    ',' || E'\\n' ORDER BY ordinal_position) || E'\\n' || ');' AS ddl
FROM information_schema.columns c
JOIN pg_tables t ON t.schemaname = c.table_schema AND t.tablename = c.table_name
WHERE c.table_schema = '${schema}' AND c.table_name = '${table}'
GROUP BY schemaname, tablename;`;
}

function ddlViewQuery(schema: string, view: string): string {
  return `-- View definition for "${schema}"."${view}"
SELECT pg_get_viewdef('"${schema}"."${view}"'::regclass, true) AS view_definition;`;
}

function ddlFunctionQuery(schema: string, fnName: string): string {
  return `-- Function definition for "${schema}"."${fnName}"
SELECT pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = '${schema}' AND p.proname = '${fnName}'
LIMIT 1;`;
}

export function ServerSidebar({
  onEditConnection,
}: {
  onEditConnection?: (projectId: string) => void;
}) {
  const projects = useProjectStore((s) => s.projects);
  const status = useProjectStore((s) => s.status);
  const schemas = useProjectStore((s) => s.schemas);
  const tables = useProjectStore((s) => s.tables);
  const columnDetails = useProjectStore((s) => s.columnDetails);
  const indexes = useProjectStore((s) => s.indexes);
  const constraints = useProjectStore((s) => s.constraints);
  const triggers = useProjectStore((s) => s.triggers);
  const rules = useProjectStore((s) => s.rules);
  const policies = useProjectStore((s) => s.policies);
  const views = useProjectStore((s) => s.views);
  const materializedViews = useProjectStore((s) => s.materializedViews);
  const functions = useProjectStore((s) => s.functions);
  const triggerFunctions = useProjectStore((s) => s.triggerFunctions);
  const connect = useProjectStore((s) => s.connect);
  const loadTables = useProjectStore((s) => s.loadTables);
  const loadTableMetadata = useProjectStore((s) => s.loadTableMetadata);
  const loadSchemaObjects = useProjectStore((s) => s.loadSchemaObjects);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const setConnectionModalOpen = useUIStore((s) => s.setConnectionModalOpen);
  const openTab = useTabStore((s) => s.openTab);
  const openMonitorTab = useTabStore((s) => s.openMonitorTab);
  const openERDTab = useTabStore((s) => s.openERDTab);
  const savedQueries = useQueryStore((s) => s.queries);
  const loadQueries = useQueryStore((s) => s.loadQueries);
  const queriesLoaded = useQueryStore((s) => s.loaded);
  const removeQuery = useQueryStore((s) => s.removeQuery);
  const { menu, showMenu, closeMenu } = useContextMenu();

  React.useEffect(() => {
    if (!queriesLoaded) void loadQueries();
  }, [queriesLoaded, loadQueries]);

  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [loading, setLoading] = React.useState<Record<string, boolean>>({});

  const toggle = (key: string) => setExpanded((p) => ({ ...p, [key]: !p[key] }));
  const isOpen = (key: string, defaultOpen = false) => expanded[key] ?? defaultOpen;

  const setLoad = (key: string, v: boolean) => setLoading((p) => ({ ...p, [key]: v }));

  const onConnect = async (projectId: string) => {
    setLoad(projectId, true);
    await connect(projectId);
    setLoad(projectId, false);
  };

  const onExpandSchema = async (projectId: string, schema: string) => {
    const key = `schema::${projectId}::${schema}`;
    toggle(key);
    if (!isOpen(key)) {
      const tKey = `${projectId}::${schema}`;
      if (!tables[tKey]) {
        setLoad(key, true);
        try {
          await Promise.all([
            loadTables(projectId, schema),
            loadSchemaObjects(projectId, schema),
          ]);
        } catch (e) {
          console.error("Failed to load schema objects:", e);
        } finally {
          setLoad(key, false);
        }
      }
    }
  };

  const onExpandTable = async (projectId: string, schema: string, table: string) => {
    const key = `table::${projectId}::${schema}::${table}`;
    toggle(key);
    const metaKey = `${projectId}::${schema}::${table}`;
    if (!isOpen(key) && !columnDetails[metaKey]) {
      setLoad(key, true);
      try {
        await loadTableMetadata(projectId, schema, table);
      } catch (e) {
        console.error("Failed to load table metadata:", e);
      } finally {
        setLoad(key, false);
      }
    }
  };

  const onOpenTableQuery = (projectId: string, schema: string, table: string) => {
    openTab(projectId, `SELECT * FROM "${schema}"."${table}" LIMIT 100;`);
  };

  const copy = (text: string) => navigator.clipboard.writeText(text);

  return (
    <div className="flex h-full flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-12 items-center justify-between border-b border-sidebar-border px-3">
        <span className="tracking-widest uppercase text-[10px] font-semibold text-sidebar-foreground">CONNECTIONS</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setConnectionModalOpen(true)}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-auto p-1">
        {(() => {
          const entries = Object.entries(projects);
          const groups = new Map<string, string[]>();
          const ungrouped: string[] = [];
          for (const [pid] of entries) {
            const slashIdx = pid.indexOf("/");
            if (slashIdx > 0) {
              const group = pid.slice(0, slashIdx);
              if (!groups.has(group)) groups.set(group, []);
              groups.get(group)!.push(pid);
            } else {
              ungrouped.push(pid);
            }
          }

          const renderServer = (pid: string) => {
            const details = projects[pid];
            if (!details) return null;
            const conn = status[pid];
            const isConnected = conn === ProjectConnectionStatus.Connected;
            const projectSchemas = schemas[pid] || [];
            const pKey = `proj::${pid}`;
            const displayName = pid.includes("/") ? pid.slice(pid.indexOf("/") + 1) : pid;

            return (
              <div key={pid}>
                <TreeRow indent={pid.includes("/") ? I.db : I.server}
                  icon={<Server className="h-3.5 w-3.5 text-primary" />}
                  label={displayName}
                bold
                expanded={isOpen(pKey, isConnected)}
                onClick={() => toggle(pKey)}
                onContextMenu={(e) => showMenu(e, [
                  { label: "New Query", icon: <Plus className="h-3 w-3" />, onClick: () => openTab(pid) },
                  ...(isConnected ? [{ label: "Performance Monitor", icon: <Activity className="h-3 w-3" />, onClick: () => openMonitorTab(pid) }] : []),
                  { label: isConnected ? "Reconnect" : "Connect", icon: <RefreshCw className="h-3 w-3" />, onClick: () => void onConnect(pid) },
                  ...(onEditConnection ? [{ label: "Edit Connection", icon: <Edit3 className="h-3 w-3" />, onClick: () => onEditConnection(pid) }] : []),
                  { separator: true as const },
                  { label: "Copy Name", icon: <Copy className="h-3 w-3" />, onClick: () => copy(pid) },
                  { separator: true as const },
                  { label: "Delete", icon: <Trash2 className="h-3 w-3" />, onClick: () => void deleteProject(pid), destructive: true },
                ])}
                trailing={
                  <div className={cn("h-2 w-2 rounded-full shrink-0",
                    isConnected && "bg-success shadow-[0_0_6px_currentColor]",
                    conn === ProjectConnectionStatus.Connecting && "bg-warning shadow-[0_0_6px_currentColor]",
                    conn === ProjectConnectionStatus.Failed && "bg-destructive shadow-[0_0_6px_currentColor]",
                    !conn && "bg-muted",
                  )} />
                }
              />

              {isOpen(pKey, isConnected) && (
                <>
                  {/* Database */}
                  <div className="flex items-center gap-1.5 py-1 hover:bg-sidebar-accent rounded-sm whitespace-nowrap"
                    style={{ paddingLeft: `${I.db}px` }}>
                    <button onClick={() => onConnect(pid)} className="flex items-center gap-1.5 flex-1 min-w-0">
                      {loading[pid] ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                        : <Database className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                      <span className="font-mono text-xs">{details.database}</span>
                    </button>
                    <div className="flex gap-0.5 pr-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-5 w-5"
                        onClick={(e) => { e.stopPropagation(); openTab(pid); }}>
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-5 w-5"
                        onClick={(e) => { e.stopPropagation(); void deleteProject(pid); }}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Schemas */}
                  {isConnected && projectSchemas.map((schema) => {
                    const sKey = `schema::${pid}::${schema}`;
                    const schemaStoreKey = `${pid}::${schema}`;
                    const schemaTables = tables[schemaStoreKey];
                    const schemaViews = views[schemaStoreKey];
                    const schemaMatViews = materializedViews[schemaStoreKey];
                    const schemaFns = functions[schemaStoreKey];
                    const schemaTrigFns = triggerFunctions[schemaStoreKey];
                    const isSchemaOpen = isOpen(sKey);

                    return (
                      <div key={schema}>
                        <TreeRow indent={I.schema}
                          icon={<FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />}
                          label={schema}
                          expanded={isSchemaOpen}
                          loading={loading[sKey]}
                          onClick={() => void onExpandSchema(pid, schema)}
                          onContextMenu={(e) => showMenu(e, [
                            { label: "ERD Diagram", icon: <Layers className="h-3 w-3" />, onClick: () => openERDTab(pid, schema) },
                            { label: "Copy Schema Name", icon: <Copy className="h-3 w-3" />, onClick: () => copy(schema) },
                            { label: "New Query", icon: <Plus className="h-3 w-3" />, onClick: () => openTab(pid, `-- Schema: ${schema}\n`) },
                          ])}
                        />

                        {isSchemaOpen && (
                          <>
                            {/* Tables category */}
                            <SectionHeader indent={I.schemaObj} label={`Tables${schemaTables ? ` (${schemaTables.length})` : ""}`}
                              icon={<Table className="h-3 w-3" />} sectionKey={`${sKey}::tables`}
                              expanded={isOpen(`${sKey}::tables`, true)} onClick={() => toggle(`${sKey}::tables`)} />
                            {isOpen(`${sKey}::tables`, true) && schemaTables?.map((ti) => {
                              const tKey = `table::${pid}::${schema}::${ti.name}`;
                              const metaKey = `${pid}::${schema}::${ti.name}`;
                              const isTableOpen = isOpen(tKey);
                              const cols = columnDetails[metaKey];
                              const idxs = indexes[metaKey];
                              const cons = constraints[metaKey];
                              const trigs = triggers[metaKey];
                              const rls = rules[metaKey];
                              const pols = policies[metaKey];
                              const pkCols = new Set((idxs ?? []).filter((i) => i.isPrimary).map((i) => i.columnName));

                              return (
                                <div key={ti.name}>
                                  <TreeRow indent={I.table}
                                    icon={<Table className="h-3.5 w-3.5 text-muted-foreground" />}
                                    label={ti.name}
                                    expanded={isTableOpen}
                                    loading={loading[tKey]}
                                    onClick={() => void onExpandTable(pid, schema, ti.name)}
                                    onDoubleClick={() => onOpenTableQuery(pid, schema, ti.name)}
                                    onContextMenu={(e) => showMenu(e, [
                                      { label: "SELECT TOP 100", icon: <Table className="h-3 w-3" />, onClick: () => onOpenTableQuery(pid, schema, ti.name) },
                                      { label: "SELECT COUNT(*)", icon: <Table className="h-3 w-3" />, onClick: () => openTab(pid, `SELECT COUNT(*) FROM "${schema}"."${ti.name}";`) },
                                      { label: "Show CREATE TABLE", icon: <FileCode className="h-3 w-3" />, onClick: () => openTab(pid, ddlTableQuery(schema, ti.name)) },
                                      { separator: true as const },
                                      { label: "Copy Name", icon: <Copy className="h-3 w-3" />, onClick: () => copy(`"${schema}"."${ti.name}"`) },
                                    ])}
                                    trailing={<span className="rounded-full bg-accent/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground shrink-0">{ti.size}</span>}
                                  />
                                  {isTableOpen && cols && (
                                    <>
                                      {/* Columns */}
                                      <SectionHeader indent={I.section} label={`Columns (${cols.length})`}
                                        icon={<Columns3 className="h-3 w-3" />} sectionKey={`${tKey}::cols`}
                                        expanded={isOpen(`${tKey}::cols`, true)} onClick={() => toggle(`${tKey}::cols`)} />
                                      {isOpen(`${tKey}::cols`, true) && cols.map((c) => (
                                        <div key={c.name} className="relative flex items-center gap-1.5 py-0.5 hover:bg-sidebar-accent rounded-sm whitespace-nowrap"
                                          style={{ paddingLeft: `${I.item}px` }}
                                          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); showMenu(e, [
                                            { label: "Copy Column Name", icon: <Copy className="h-3 w-3" />, onClick: () => copy(c.name) },
                                          ]); }}>
                                          {pkCols.has(c.name) ? <Key className="h-3 w-3 shrink-0 text-warning" /> : <Columns3 className="h-3 w-3 shrink-0 text-muted-foreground/50" />}
                                          <span className="font-mono text-[11px] text-foreground">{c.name}</span>
                                          <span className="font-mono text-[10px] text-muted-foreground">{c.dataType}</span>
                                          {c.nullable && <span className="font-mono text-[9px] text-muted-foreground/40">NULL</span>}
                                        </div>
                                      ))}

                                      {/* Indexes */}
                                      {idxs && idxs.length > 0 && (
                                        <>
                                          <SectionHeader indent={I.section} label={`Indexes (${new Set(idxs.map((i) => i.indexName)).size})`}
                                            icon={<Key className="h-3 w-3" />} sectionKey={`${tKey}::idx`}
                                            expanded={isOpen(`${tKey}::idx`)} onClick={() => toggle(`${tKey}::idx`)} />
                                          {isOpen(`${tKey}::idx`) && Array.from(new Set(idxs.map((i) => i.indexName))).map((name) => {
                                            const entries = idxs.filter((i) => i.indexName === name);
                                            const f = entries[0];
                                            return (
                                              <div key={name} className="relative flex items-center gap-1.5 py-0.5 hover:bg-sidebar-accent rounded-sm whitespace-nowrap" style={{ paddingLeft: `${I.item}px` }}>
                                                {f.isPrimary ? <Key className="h-3 w-3 shrink-0 text-warning" /> : f.isUnique ? <Shield className="h-3 w-3 shrink-0 text-blue-500" /> : <Key className="h-3 w-3 shrink-0 text-muted-foreground/50" />}
                                                <span className="font-mono text-[11px] text-foreground">{name}</span>
                                                <span className="font-mono text-[10px] text-muted-foreground">({entries.map((e) => e.columnName).join(", ")})</span>
                                                {f.isUnique && <span className="font-mono text-[9px] text-blue-500/60">UNIQUE</span>}
                                              </div>
                                            );
                                          })}
                                        </>
                                      )}

                                      {/* Constraints */}
                                      {cons && cons.length > 0 && (
                                        <>
                                          <SectionHeader indent={I.section} label={`Constraints (${new Set(cons.map((c) => c.constraintName)).size})`}
                                            icon={<Link2 className="h-3 w-3" />} sectionKey={`${tKey}::con`}
                                            expanded={isOpen(`${tKey}::con`)} onClick={() => toggle(`${tKey}::con`)} />
                                          {isOpen(`${tKey}::con`) && Array.from(new Set(cons.map((c) => c.constraintName))).map((name) => {
                                            const f = cons.find((c) => c.constraintName === name)!;
                                            return (
                                              <div key={name} className="relative flex items-center gap-1.5 py-0.5 hover:bg-sidebar-accent rounded-sm whitespace-nowrap" style={{ paddingLeft: `${I.item}px` }}>
                                                <Link2 className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                                                <span className="font-mono text-[11px] text-foreground">{name}</span>
                                                <span className="font-mono text-[10px] text-muted-foreground">{f.constraintType}</span>
                                              </div>
                                            );
                                          })}
                                        </>
                                      )}

                                      {/* Triggers */}
                                      {trigs && trigs.length > 0 && (
                                        <>
                                          <SectionHeader indent={I.section} label={`Triggers (${trigs.length})`}
                                            icon={<Zap className="h-3 w-3" />} sectionKey={`${tKey}::trig`}
                                            expanded={isOpen(`${tKey}::trig`)} onClick={() => toggle(`${tKey}::trig`)} />
                                          {isOpen(`${tKey}::trig`) && trigs.map((t) => (
                                            <div key={`${t.triggerName}-${t.event}`} className="relative flex items-center gap-1.5 py-0.5 hover:bg-sidebar-accent rounded-sm whitespace-nowrap" style={{ paddingLeft: `${I.item}px` }}>
                                              <Zap className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                                              <span className="font-mono text-[11px] text-foreground">{t.triggerName}</span>
                                              <span className="font-mono text-[10px] text-muted-foreground">{t.timing} {t.event}</span>
                                            </div>
                                          ))}
                                        </>
                                      )}

                                      {/* Rules */}
                                      {rls && rls.length > 0 && (
                                        <>
                                          <SectionHeader indent={I.section} label={`Rules (${rls.length})`}
                                            icon={<ScrollText className="h-3 w-3" />} sectionKey={`${tKey}::rules`}
                                            expanded={isOpen(`${tKey}::rules`)} onClick={() => toggle(`${tKey}::rules`)} />
                                          {isOpen(`${tKey}::rules`) && rls.map((r) => (
                                            <div key={r.ruleName} className="relative flex items-center gap-1.5 py-0.5 hover:bg-sidebar-accent rounded-sm whitespace-nowrap" style={{ paddingLeft: `${I.item}px` }}>
                                              <ScrollText className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                                              <span className="font-mono text-[11px] text-foreground">{r.ruleName}</span>
                                              <span className="font-mono text-[10px] text-muted-foreground">{r.event}</span>
                                            </div>
                                          ))}
                                        </>
                                      )}

                                      {/* RLS Policies */}
                                      {pols && pols.length > 0 && (
                                        <>
                                          <SectionHeader indent={I.section} label={`RLS Policies (${pols.length})`}
                                            icon={<Lock className="h-3 w-3" />} sectionKey={`${tKey}::pol`}
                                            expanded={isOpen(`${tKey}::pol`)} onClick={() => toggle(`${tKey}::pol`)} />
                                          {isOpen(`${tKey}::pol`) && pols.map((p) => (
                                            <div key={p.policyName} className="relative flex items-center gap-1.5 py-0.5 hover:bg-sidebar-accent rounded-sm whitespace-nowrap" style={{ paddingLeft: `${I.item}px` }}>
                                              <Lock className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                                              <span className="font-mono text-[11px] text-foreground">{p.policyName}</span>
                                              <span className="font-mono text-[10px] text-muted-foreground">{p.permissive} {p.command}</span>
                                            </div>
                                          ))}
                                        </>
                                      )}
                                    </>
                                  )}
                                </div>
                              );
                            })}

                            {/* Views category */}
                            {schemaViews && schemaViews.length > 0 && (
                              <>
                                <SectionHeader indent={I.schemaObj} label={`Views (${schemaViews.length})`}
                                  icon={<Eye className="h-3 w-3" />} sectionKey={`${sKey}::views`}
                                  expanded={isOpen(`${sKey}::views`)} onClick={() => toggle(`${sKey}::views`)} />
                                {isOpen(`${sKey}::views`) && schemaViews.map((v) => (
                                  <TreeRow key={v} indent={I.table}
                                    icon={<Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                                    label={v}
                                    onClick={() => onOpenTableQuery(pid, schema, v)}
                                    onContextMenu={(e) => showMenu(e, [
                                      { label: "SELECT TOP 100", icon: <Eye className="h-3 w-3" />, onClick: () => onOpenTableQuery(pid, schema, v) },
                                      { label: "Show CREATE VIEW", icon: <FileCode className="h-3 w-3" />, onClick: () => openTab(pid, ddlViewQuery(schema, v)) },
                                      { label: "Copy Name", icon: <Copy className="h-3 w-3" />, onClick: () => copy(`"${schema}"."${v}"`) },
                                    ])}
                                  />
                                ))}
                              </>
                            )}

                            {/* Materialized Views category */}
                            {schemaMatViews && schemaMatViews.length > 0 && (
                              <>
                                <SectionHeader indent={I.schemaObj} label={`Materialized Views (${schemaMatViews.length})`}
                                  icon={<Layers className="h-3 w-3" />} sectionKey={`${sKey}::matviews`}
                                  expanded={isOpen(`${sKey}::matviews`)} onClick={() => toggle(`${sKey}::matviews`)} />
                                {isOpen(`${sKey}::matviews`) && schemaMatViews.map((mv) => (
                                  <TreeRow key={mv} indent={I.table}
                                    icon={<Layers className="h-3.5 w-3.5 text-muted-foreground" />}
                                    label={mv}
                                    onClick={() => onOpenTableQuery(pid, schema, mv)}
                                    onContextMenu={(e) => showMenu(e, [
                                      { label: "SELECT TOP 100", icon: <Layers className="h-3 w-3" />, onClick: () => onOpenTableQuery(pid, schema, mv) },
                                      { label: "REFRESH", icon: <RefreshCw className="h-3 w-3" />, onClick: () => openTab(pid, `REFRESH MATERIALIZED VIEW "${schema}"."${mv}";`) },
                                      { label: "Copy Name", icon: <Copy className="h-3 w-3" />, onClick: () => copy(`"${schema}"."${mv}"`) },
                                    ])}
                                  />
                                ))}
                              </>
                            )}

                            {/* Functions category */}
                            {schemaFns && schemaFns.length > 0 && (
                              <>
                                <SectionHeader indent={I.schemaObj} label={`Functions (${schemaFns.length})`}
                                  icon={<FileCode className="h-3 w-3" />} sectionKey={`${sKey}::fns`}
                                  expanded={isOpen(`${sKey}::fns`)} onClick={() => toggle(`${sKey}::fns`)} />
                                {isOpen(`${sKey}::fns`) && schemaFns.map((fn, i) => (
                                  <div key={`${fn.name}-${i}`} className="relative flex items-center gap-1.5 py-0.5 hover:bg-sidebar-accent rounded-sm whitespace-nowrap" style={{ paddingLeft: `${I.table}px` }}
                                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); showMenu(e, [
                                      { label: "Show Definition", icon: <FileCode className="h-3 w-3" />, onClick: () => openTab(pid, ddlFunctionQuery(schema, fn.name)) },
                                      { label: "Copy Name", icon: <Copy className="h-3 w-3" />, onClick: () => copy(fn.name) },
                                    ]); }}>
                                    <FileCode className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                                    <span className="font-mono text-[11px] text-foreground">{fn.name}({fn.arguments ? "..." : ""})</span>
                                    <span className="font-mono text-[10px] text-muted-foreground">{fn.returnType}</span>
                                  </div>
                                ))}
                              </>
                            )}

                            {/* Trigger Functions category */}
                            {schemaTrigFns && schemaTrigFns.length > 0 && (
                              <>
                                <SectionHeader indent={I.schemaObj} label={`Trigger Functions (${schemaTrigFns.length})`}
                                  icon={<Zap className="h-3 w-3" />} sectionKey={`${sKey}::trigfns`}
                                  expanded={isOpen(`${sKey}::trigfns`)} onClick={() => toggle(`${sKey}::trigfns`)} />
                                {isOpen(`${sKey}::trigfns`) && schemaTrigFns.map((fn, i) => (
                                  <div key={`${fn.name}-${i}`} className="relative flex items-center gap-1.5 py-0.5 hover:bg-sidebar-accent rounded-sm whitespace-nowrap" style={{ paddingLeft: `${I.table}px` }}>
                                    <Zap className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                                    <span className="font-mono text-[11px] text-foreground">{fn.name}()</span>
                                    <span className="font-mono text-[10px] text-muted-foreground">trigger</span>
                                  </div>
                                ))}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
              </div>
            );
          };

          return (
            <>
              {/* Grouped connections */}
              {Array.from(groups.entries()).map(([group, pids]) => {
                const gKey = `group::${group}`;
                return (
                  <div key={gKey}>
                    <TreeRow
                      indent={I.server}
                      icon={<FolderOpen className="h-3.5 w-3.5 text-warning" />}
                      label={group}
                      bold
                      expanded={isOpen(gKey, true)}
                      onClick={() => toggle(gKey)}
                    />
                    {isOpen(gKey, true) && pids.map(renderServer)}
                  </div>
                );
              })}
              {/* Ungrouped connections */}
              {ungrouped.map(renderServer)}
            </>
          );
        })()}
      </div>

      {/* Saved Queries — always visible */}
      <div className="border-t border-sidebar-border">
        <div className="flex h-8 items-center justify-between px-3">
          <span className="tracking-widest uppercase text-[10px] font-semibold text-sidebar-foreground">SAVED QUERIES</span>
          {savedQueries.length > 0 && (
            <span className="text-[10px] text-muted-foreground">{savedQueries.length}</span>
          )}
        </div>
        {savedQueries.length > 0 ? (
          <div className="overflow-y-auto p-1 max-h-48">
            {savedQueries.map((q) => (
              <TreeRow
                key={q.id}
                indent={I.server}
                icon={<FileText className="h-3.5 w-3.5 text-primary/60" />}
                label={q.title}
                onClick={() => openTab(q.projectId, q.sql)}
                onContextMenu={(e) => showMenu(e, [
                  { label: "Open in Tab", icon: <FileText className="h-3 w-3" />, onClick: () => openTab(q.projectId, q.sql) },
                  { label: "Copy SQL", icon: <Copy className="h-3 w-3" />, onClick: () => copy(q.sql) },
                  { separator: true as const },
                  { label: "Delete", icon: <Trash2 className="h-3 w-3" />, onClick: () => void removeQuery(q.id), destructive: true },
                ])}
                trailing={
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0">{q.projectId}</span>
                }
              />
            ))}
          </div>
        ) : (
          <div className="px-3 pb-2 text-[11px] text-muted-foreground/60">
            No saved queries yet. Use the Save button in the toolbar to save the current query.
          </div>
        )}
      </div>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={closeMenu} />}
    </div>
  );
}

/** Indent guide lines */
function IndentGuides({ indent }: { indent: number }) {
  const guides: number[] = [];
  // Draw guides at each nesting level (every 12px starting from the first nested level)
  for (let x = I.db + 4; x < indent; x += 12) {
    guides.push(x);
  }
  return (
    <>
      {guides.map((x) => (
        <span key={x} className="sidebar-indent-guide" style={{ left: `${x}px` }} />
      ))}
    </>
  );
}

/** Generic tree row */
function TreeRow({
  indent, icon, label, bold, expanded, loading: isLoading, trailing,
  onClick, onDoubleClick, onContextMenu,
}: {
  indent: number;
  icon: React.ReactNode;
  label: string;
  bold?: boolean;
  expanded?: boolean;
  loading?: boolean;
  trailing?: React.ReactNode;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className="relative flex w-full items-center gap-1.5 py-1 text-left text-sm hover:bg-white/[0.06] dark:hover:bg-white/[0.06] hover:bg-black/[0.04] transition-colors rounded-sm whitespace-nowrap"
      style={{ paddingLeft: `${indent}px` }}
    >
      <IndentGuides indent={indent} />
      {expanded !== undefined ? (
        isLoading ? <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
          : expanded ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
            : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
      ) : null}
      <span className="shrink-0">{icon}</span>
      <span className={cn("font-mono text-xs", bold && "font-semibold")}>{label}</span>
      {trailing && <span className="ml-auto mr-1">{trailing}</span>}
    </button>
  );
}

/** Collapsible section header */
function SectionHeader({
  indent, label, icon, expanded, onClick,
}: {
  indent: number;
  label: string;
  icon: React.ReactNode;
  sectionKey?: string;
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className="relative flex w-full items-center gap-1.5 py-0.5 text-left hover:bg-sidebar-accent transition-colors rounded-sm whitespace-nowrap"
      style={{ paddingLeft: `${indent}px` }}>
      <IndentGuides indent={indent} />
      {expanded ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
      <span className="shrink-0">{icon}</span>
      <span className="font-mono text-[11px] font-semibold text-muted-foreground">{label}</span>
    </button>
  );
}
