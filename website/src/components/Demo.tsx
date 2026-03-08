import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Loader2,
  ChevronDown,
  ChevronRight,
  Database,
  Table,
  Columns3,
  Key,
  RotateCcw,
  Server,
  FolderOpen,
} from "lucide-react";
import {
  useDBReady,
  useTables,
  useColumns,
  useExecuteSQL,
  useResetDB,
} from "@/hooks/use-sql";
import type { QueryResult } from "@/hooks/use-sql";

const SAMPLE_QUERIES: { label: string; sql: string }[] = [
  {
    label: "All Employees",
    sql: "SELECT * FROM employees ORDER BY name;",
  },
  {
    label: "Department Stats",
    sql: `SELECT department,
       COUNT(*) AS headcount,
       ROUND(AVG(salary), 2) AS avg_salary
FROM employees
WHERE is_active = true
GROUP BY department
ORDER BY avg_salary DESC;`,
  },
  {
    label: "Top Salaries",
    sql: `SELECT name, department, salary
FROM employees
ORDER BY salary DESC
LIMIT 5;`,
  },
  {
    label: "Active Projects",
    sql: `SELECT p.title, d.name AS department, p.status, p.start_date
FROM projects p
JOIN departments d ON d.id = p.department_id
WHERE p.status = 'active'
ORDER BY p.start_date;`,
  },
  {
    label: "Budget Overview",
    sql: `SELECT d.name,
       d.budget,
       d.location,
       COUNT(p.id) AS project_count
FROM departments d
LEFT JOIN projects p ON p.department_id = d.id
GROUP BY d.id, d.name, d.budget, d.location
ORDER BY d.budget DESC;`,
  },
];

export function Demo() {
  const { data: ready } = useDBReady();
  const [sql, setSql] = useState(SAMPLE_QUERIES[0].sql);
  const [result, setResult] = useState<QueryResult | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const executeMutation = useExecuteSQL();
  const resetMutation = useResetDB();

  const execute = useCallback(() => {
    if (!sql.trim()) return;
    executeMutation.mutate(sql, {
      onSuccess: (data) => setResult(data),
    });
  }, [sql, executeMutation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      execute();
    }
  };

  // Auto-run first query when ready
  useEffect(() => {
    if (ready && !result) {
      executeMutation.mutate(SAMPLE_QUERIES[0].sql, {
        onSuccess: (data) => setResult(data),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!ready) {
    return (
      <section className="px-6 py-24 max-w-6xl mx-auto text-center" id="demo">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Loading PostgreSQL runtime...</p>
      </section>
    );
  }

  return (
    <section className="px-6 py-24 max-w-6xl mx-auto" id="demo">
      <div className="border-t border-border/45 pt-10">
        <div className="mb-8 max-w-3xl">
          <p className="section-label mb-3">
            In-browser sandbox
          </p>
          <h2 className="font-display text-[2.6rem] leading-[0.96] md:text-[3.9rem]">
            Touch the flow
            <br />
            before you
            <br />
            install it.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Full PostgreSQL running in WebAssembly. Real SQL, seeded data, no setup friction.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {SAMPLE_QUERIES.map((q) => (
              <button
                key={q.label}
                onClick={() => {
                  setSql(q.sql);
                  executeMutation.mutate(q.sql, {
                    onSuccess: (data) => setResult(data),
                  });
                }}
                className={`rounded-full border px-4 py-2 text-left text-xs font-mono transition-colors ${
                  sql === q.sql
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card/60 text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-3 border-t border-border/40 pt-4 sm:grid-cols-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                Engine
              </div>
              <div className="mt-2 text-sm text-foreground">PGlite</div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                Dataset
              </div>
              <div className="mt-2 text-sm text-foreground">Seeded demo schema</div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                Setup
              </div>
              <div className="mt-2 text-sm text-foreground">Zero install</div>
            </div>
          </div>
        </div>

        <div className="section-frame overflow-hidden rounded-[28px]">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-card/80 border-b border-border/50">
            <div className="flex gap-1.5">
              <span className="h-3 w-3 rounded-full bg-red-500/80" />
              <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
              <span className="h-3 w-3 rounded-full bg-green-500/80" />
            </div>
            <span className="flex-1 text-center text-xs text-muted-foreground font-mono">
              RSQL — browser.sandbox
            </span>
            <button
              onClick={() => resetMutation.mutate()}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Reset database"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex h-[480px]">
            <DemoSidebar
              onTableClick={(table) => {
                const q = `SELECT * FROM ${table} LIMIT 100;`;
                setSql(q);
                executeMutation.mutate(q, {
                  onSuccess: (data) => setResult(data),
                });
              }}
            />

            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/50 bg-card/40">
                <button
                  onClick={execute}
                  disabled={executeMutation.isPending}
                  className="gradient-btn inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {executeMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                  Execute
                </button>
                <span className="text-[10px] text-muted-foreground font-mono ml-auto">
                  {result
                    ? result.error
                      ? "Error"
                      : `${result.rowCount} rows in ${result.time.toFixed(1)}ms`
                    : "⌘+Enter to run"}
                </span>
              </div>

              <div className="relative flex-none h-[180px] border-b border-border/50">
                <textarea
                  ref={textareaRef}
                  value={sql}
                  onChange={(e) => setSql(e.target.value)}
                  onKeyDown={handleKeyDown}
                  spellCheck={false}
                  className="w-full h-full resize-none bg-[var(--editor-bg)] text-foreground font-mono text-[13px] leading-6 p-4 focus:outline-none"
                  placeholder="Write your SQL here..."
                />
              </div>

              <div className="flex-1 overflow-auto">
                {result && <DemoResults result={result} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DemoSidebar({ onTableClick }: { onTableClick: (table: string) => void }) {
  const { data: tableList } = useTables();
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [serverOpen, setServerOpen] = useState(true);
  const [schemaOpen, setSchemaOpen] = useState(true);

  return (
    <div className="w-[200px] flex-none border-r border-border/50 bg-card/30 overflow-y-auto text-xs select-none">
      <div className="px-2 py-2 border-b border-border/50">
        <span className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase">
          NAVIGATOR
        </span>
      </div>

      {/* Server */}
      <button
        onClick={() => setServerOpen(!serverOpen)}
        className="surface-hover flex items-center gap-1 w-full px-2 py-1 text-left"
      >
        {serverOpen ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        <Server className="h-3 w-3 text-primary" />
        <span className="font-mono font-semibold text-xs">local.runtime</span>
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-success" />
      </button>

      {serverOpen && (
        <>
          {/* Databases */}
          <div className="flex items-center gap-1 px-2 py-1 pl-5 text-muted-foreground">
            <ChevronDown className="h-3 w-3" />
            <Database className="h-3 w-3" />
            <span className="font-mono text-[11px]">catalog (1)</span>
          </div>

          {/* demo_db */}
          <button
            onClick={() => setSchemaOpen(!schemaOpen)}
            className="surface-hover flex items-center gap-1 w-full px-2 py-1 pl-8 text-left"
          >
            {schemaOpen ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            <Database className="h-3 w-3 text-muted-foreground" />
            <span className="font-mono text-[11px]">demo.workspace</span>
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-success" />
          </button>

          {schemaOpen && (
            <>
              {/* public schema */}
              <div className="flex items-center gap-1 px-2 py-0.5 pl-11 text-muted-foreground">
                <ChevronDown className="h-3 w-3" />
                <FolderOpen className="h-3 w-3" />
                <span className="font-mono text-[11px]">schema/public</span>
              </div>

              {/* Tables */}
              {tableList?.map((table) => (
                <TableNode
                  key={table}
                  table={table}
                  expanded={expandedTable === table}
                  onToggle={() => setExpandedTable(expandedTable === table ? null : table)}
                  onClick={() => onTableClick(table)}
                />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

function TableNode({
  table,
  expanded,
  onToggle,
  onClick,
}: {
  table: string;
  expanded: boolean;
  onToggle: () => void;
  onClick: () => void;
}) {
  const { data: columns } = useColumns(expanded ? table : null);

  return (
    <div>
      <button
        className="surface-hover flex items-center gap-1 w-full px-2 py-0.5 pl-[52px] text-left group"
        onClick={onToggle}
        onDoubleClick={onClick}
      >
        {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        <Table className="h-3 w-3 text-muted-foreground" />
        <span className="font-mono text-[11px] text-foreground">{table}</span>
      </button>
      {expanded && columns && (
        <div>
          {columns.map((col) => (
            <div
              key={col.column_name}
              className="flex items-center gap-1 px-2 py-0 pl-[72px] text-muted-foreground"
            >
              {col.column_name === "id" ? (
                <Key className="h-2.5 w-2.5 text-yellow-500" />
              ) : (
                <Columns3 className="h-2.5 w-2.5 text-muted-foreground/40" />
              )}
              <span className="font-mono text-[10px] text-foreground/80">{col.column_name}</span>
              <span className="font-mono text-[9px] text-muted-foreground/60">{col.data_type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DemoResults({ result }: { result: QueryResult }) {
  if (result.error) {
    return (
      <div className="p-4">
        <pre className="font-mono text-xs text-destructive whitespace-pre-wrap">{result.error}</pre>
      </div>
    );
  }

  if (!result.columns.length) {
    return (
      <div className="p-4 text-xs text-muted-foreground font-mono">
        Query executed successfully. No rows returned.
      </div>
    );
  }

  return (
    <table className="w-full text-left font-mono text-[12px] border-collapse">
      <thead>
        <tr>
          {result.columns.map((col) => (
            <th
              key={col}
              className="sticky top-0 z-10 border-b border-r border-border/30 bg-card px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap text-muted-foreground"
            >
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {result.rows.map((row, i) => (
          <tr key={i} className="hover:bg-[var(--table-hover)] even:bg-[var(--table-stripe)]">
            {result.columns.map((col) => (
              <td
                key={col}
                className="px-3 py-1 text-foreground/90 border-b border-r border-border/20 whitespace-nowrap"
              >
                {formatCell(row[col])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatCell(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "true" : "false";
  return String(val);
}
