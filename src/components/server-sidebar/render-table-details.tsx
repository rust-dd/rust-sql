import { Columns3, Copy, Key, Link2, Lock, ScrollText, Shield, Zap } from "lucide-react";
import { I } from "./constants";
import { SectionHeader } from "./section-header";
import type { SidebarRenderCtx } from "./types";

export function renderTableDetails(
  ctx: SidebarRenderCtx,
  pid: string,
  schema: string,
  tableName: string,
) {
  const {
    columnDetails,
    indexes,
    constraints,
    triggers,
    rules,
    policies,
    isOpen,
    toggle,
    showMenu,
    copy,
  } = ctx;
  const tKey = `table::${pid}::${schema}::${tableName}`;
  const metaKey = `${pid}::${schema}::${tableName}`;
  const cols = columnDetails[metaKey];
  const idxs = indexes[metaKey];
  const cons = constraints[metaKey];
  const trigs = triggers[metaKey];
  const rls = rules[metaKey];
  const pols = policies[metaKey];
  const pkCols = new Set((idxs ?? []).filter((i) => i.isPrimary).map((i) => i.columnName));

  if (!cols) return null;

  return (
    <>
      <SectionHeader
        indent={I.section}
        label={`Columns (${cols.length})`}
        icon={<Columns3 className="h-3 w-3" />}
        sectionKey={`${tKey}::cols`}
        expanded={isOpen(`${tKey}::cols`, true)}
        onClick={() => toggle(`${tKey}::cols`)}
      />
      {isOpen(`${tKey}::cols`, true) &&
        cols.map((c) => (
          <div
            key={c.name}
            className="relative flex items-center gap-1.5 py-0.5 hover:bg-sidebar-accent rounded-sm whitespace-nowrap"
            style={{ paddingLeft: `${I.item}px` }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              showMenu(e, [
                {
                  label: "Copy Column Name",
                  icon: <Copy className="h-3 w-3" />,
                  onClick: () => copy(c.name),
                },
              ]);
            }}
          >
            {pkCols.has(c.name) ? (
              <Key className="h-3 w-3 shrink-0 text-warning" />
            ) : (
              <Columns3 className="h-3 w-3 shrink-0 text-muted-foreground/50" />
            )}
            <span className="font-mono text-[11px] text-foreground">{c.name}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{c.dataType}</span>
            {c.nullable && (
              <span className="font-mono text-[9px] text-muted-foreground/40">NULL</span>
            )}
          </div>
        ))}

      {idxs && idxs.length > 0 && (
        <>
          <SectionHeader
            indent={I.section}
            label={`Indexes (${new Set(idxs.map((i) => i.indexName)).size})`}
            icon={<Key className="h-3 w-3" />}
            sectionKey={`${tKey}::idx`}
            expanded={isOpen(`${tKey}::idx`)}
            onClick={() => toggle(`${tKey}::idx`)}
          />
          {isOpen(`${tKey}::idx`) &&
            Array.from(new Set(idxs.map((i) => i.indexName))).map((name) => {
              const idxEntries = idxs.filter((i) => i.indexName === name);
              const f = idxEntries[0];
              return (
                <div
                  key={name}
                  className="relative flex items-center gap-1.5 py-0.5 hover:bg-sidebar-accent rounded-sm whitespace-nowrap"
                  style={{ paddingLeft: `${I.item}px` }}
                >
                  {f.isPrimary ? (
                    <Key className="h-3 w-3 shrink-0 text-warning" />
                  ) : f.isUnique ? (
                    <Shield className="h-3 w-3 shrink-0 text-blue-500" />
                  ) : (
                    <Key className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                  )}
                  <span className="font-mono text-[11px] text-foreground">{name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    ({idxEntries.map((e) => e.columnName).join(", ")})
                  </span>
                  {f.isUnique && (
                    <span className="font-mono text-[9px] text-blue-500/60">UNIQUE</span>
                  )}
                </div>
              );
            })}
        </>
      )}

      {cons && cons.length > 0 && (
        <>
          <SectionHeader
            indent={I.section}
            label={`Constraints (${new Set(cons.map((c) => c.constraintName)).size})`}
            icon={<Link2 className="h-3 w-3" />}
            sectionKey={`${tKey}::con`}
            expanded={isOpen(`${tKey}::con`)}
            onClick={() => toggle(`${tKey}::con`)}
          />
          {isOpen(`${tKey}::con`) &&
            Array.from(new Set(cons.map((c) => c.constraintName))).map((name) => {
              const f = cons.find((c) => c.constraintName === name)!;
              return (
                <div
                  key={name}
                  className="relative flex items-center gap-1.5 py-0.5 hover:bg-sidebar-accent rounded-sm whitespace-nowrap"
                  style={{ paddingLeft: `${I.item}px` }}
                >
                  <Link2 className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                  <span className="font-mono text-[11px] text-foreground">{name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {f.constraintType}
                  </span>
                </div>
              );
            })}
        </>
      )}

      {trigs && trigs.length > 0 && (
        <>
          <SectionHeader
            indent={I.section}
            label={`Triggers (${trigs.length})`}
            icon={<Zap className="h-3 w-3" />}
            sectionKey={`${tKey}::trig`}
            expanded={isOpen(`${tKey}::trig`)}
            onClick={() => toggle(`${tKey}::trig`)}
          />
          {isOpen(`${tKey}::trig`) &&
            trigs.map((t) => (
              <div
                key={`${t.triggerName}-${t.event}`}
                className="relative flex items-center gap-1.5 py-0.5 hover:bg-sidebar-accent rounded-sm whitespace-nowrap"
                style={{ paddingLeft: `${I.item}px` }}
              >
                <Zap className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                <span className="font-mono text-[11px] text-foreground">{t.triggerName}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {t.timing} {t.event}
                </span>
              </div>
            ))}
        </>
      )}

      {rls && rls.length > 0 && (
        <>
          <SectionHeader
            indent={I.section}
            label={`Rules (${rls.length})`}
            icon={<ScrollText className="h-3 w-3" />}
            sectionKey={`${tKey}::rules`}
            expanded={isOpen(`${tKey}::rules`)}
            onClick={() => toggle(`${tKey}::rules`)}
          />
          {isOpen(`${tKey}::rules`) &&
            rls.map((r) => (
              <div
                key={r.ruleName}
                className="relative flex items-center gap-1.5 py-0.5 hover:bg-sidebar-accent rounded-sm whitespace-nowrap"
                style={{ paddingLeft: `${I.item}px` }}
              >
                <ScrollText className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                <span className="font-mono text-[11px] text-foreground">{r.ruleName}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{r.event}</span>
              </div>
            ))}
        </>
      )}

      {pols && pols.length > 0 && (
        <>
          <SectionHeader
            indent={I.section}
            label={`RLS Policies (${pols.length})`}
            icon={<Lock className="h-3 w-3" />}
            sectionKey={`${tKey}::pol`}
            expanded={isOpen(`${tKey}::pol`)}
            onClick={() => toggle(`${tKey}::pol`)}
          />
          {isOpen(`${tKey}::pol`) &&
            pols.map((p) => (
              <div
                key={p.policyName}
                className="relative flex items-center gap-1.5 py-0.5 hover:bg-sidebar-accent rounded-sm whitespace-nowrap"
                style={{ paddingLeft: `${I.item}px` }}
              >
                <Lock className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                <span className="font-mono text-[11px] text-foreground">{p.policyName}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {p.permissive} {p.command}
                </span>
              </div>
            ))}
        </>
      )}
    </>
  );
}
