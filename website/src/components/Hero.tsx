import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Download, Github } from "lucide-react";

function detectPlatform() {
  if (typeof navigator === "undefined") return "Download";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "Download for macOS";
  if (ua.includes("win")) return "Download for Windows";
  return "Download for Linux";
}

const TYPEWRITER_SQL = `SELECT e.name, d.name AS department,
       COUNT(p.id) AS projects,
       ROUND(AVG(e.salary), 2) AS avg_salary
FROM employees e
JOIN departments d ON d.id = e.dept_id
LEFT JOIN projects p ON p.department_id = d.id
WHERE e.is_active = true
GROUP BY e.name, d.name
ORDER BY avg_salary DESC
LIMIT 10;`;

const RESULT_ROWS = [
  ["Alice Chen", "Engineering", "4", "$125,400"],
  ["Bob Park", "Engineering", "3", "$118,200"],
  ["Carol Wu", "Design", "2", "$105,800"],
  ["Dan Lee", "Marketing", "1", "$98,500"],
  ["Eve Kim", "Product", "3", "$112,300"],
];

function useTypewriter(text: string, speed = 28, delay = 1000) {
  const [pos, setPos] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  useEffect(() => {
    if (!started || pos >= text.length) return;
    const ch = text[pos];
    const ms = ch === "\n" ? 100 : ch === " " ? 40 : speed + Math.random() * 15;
    const t = setTimeout(() => setPos(pos + 1), ms);
    return () => clearTimeout(t);
  }, [started, pos, text, speed]);

  return { text: text.slice(0, pos), done: pos >= text.length };
}

function tokenize(sql: string) {
  const KW = new Set(["SELECT","FROM","JOIN","LEFT","RIGHT","ON","WHERE","GROUP","BY","ORDER","AS","AND","OR","LIMIT","DESC","ASC","ROUND","AVG","COUNT","SUM","MIN","MAX","TRUE","FALSE"]);
  const TABLES = new Set(["employees","departments","projects"]);

  return sql.split(/(\s+|[(),;.*=])/).map((t, i) => {
    if (KW.has(t.toUpperCase())) return <span key={i} className="text-violet-400">{t}</span>;
    if (TABLES.has(t)) return <span key={i} className="text-emerald-400/80">{t}</span>;
    if (/^\d+$/.test(t)) return <span key={i} className="text-amber-300/80">{t}</span>;
    if (/^(name|department|dept_id|salary|is_active|id|title|department_id|avg_salary)$/.test(t))
      return <span key={i} className="text-sky-300/80">{t}</span>;
    if (/^(e|d|p)$/.test(t)) return <span key={i} className="text-sky-300/50">{t}</span>;
    return <span key={i} className="text-zinc-400">{t}</span>;
  });
}

export function Hero() {
  const platform = useMemo(() => detectPlatform(), []);
  const { text: typed, done } = useTypewriter(TYPEWRITER_SQL);
  const lineCount = typed.split("\n").length;

  return (
    <section className="relative px-6 pt-32 pb-4 md:pt-44">
      <div className="mx-auto max-w-[1080px]">
        {/* ─── Headline ─── */}
        <div className="text-center animate-in">
          <h1 className="font-display text-[clamp(2.8rem,8vw,6rem)]">
            Query Postgres at
            <br />
            <span className="accent-glow">the speed of thought</span>
          </h1>
        </div>

        <p className="mx-auto mt-6 max-w-lg text-center text-lg text-[var(--fg-muted)] leading-relaxed animate-in d1" style={{ opacity: 0 }}>
          A fast, native PostgreSQL workbench built with Rust and Tauri.
          Open source and free forever.
        </p>

        {/* ─── CTAs ─── */}
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center animate-in d2" style={{ opacity: 0 }}>
          <a
            href="https://github.com/rust-dd/rust-sql/releases/latest"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            <Download className="h-4 w-4" />
            {platform}
          </a>
          <a
            href="https://github.com/rust-dd/rust-sql"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            <Github className="h-4 w-4" />
            Star on GitHub
          </a>
        </div>

        <div className="mt-4 flex justify-center animate-in d3" style={{ opacity: 0 }}>
          <a
            href="#demo"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors group"
          >
            or try it in the browser
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>

        {/* ─── Product Visual ─── */}
        <div className="mt-16 animate-scale-in d3" style={{ opacity: 0 }}>
          <div className="product-frame">
            <div className="product-frame-titlebar">
              <div className="product-frame-dot bg-[#ff5f57]" />
              <div className="product-frame-dot bg-[#febc2e]" />
              <div className="product-frame-dot bg-[#28c840]" />
              <span className="flex-1 text-center text-xs text-[var(--fg-muted)] font-[var(--font-mono)]">
                RSQL
              </span>
              <div className="flex items-center gap-1.5 text-[10px] font-[var(--font-mono)] text-[var(--fg-subtle)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                connected
              </div>
            </div>

            <div className="flex min-h-[380px] md:min-h-[440px]">
              {/* Sidebar */}
              <div className="hidden sm:flex w-[180px] flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-raised)]">
                <div className="p-3 text-[10px] font-[var(--font-mono)] uppercase tracking-widest text-[var(--fg-subtle)]">
                  Tables
                </div>
                {["employees", "departments", "projects", "salaries", "reviews"].map((t, i) => (
                  <div
                    key={t}
                    className={`mx-2 px-2.5 py-1.5 rounded-lg text-[12px] font-[var(--font-mono)] flex items-center gap-2 ${
                      i === 0
                        ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                        : "text-[var(--fg-muted)]"
                    }`}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0 opacity-60">
                      <rect x="1" y="1" width="10" height="3" rx="1" fill="currentColor" />
                      <rect x="1" y="5" width="10" height="3" rx="1" fill="currentColor" opacity="0.4" />
                      <rect x="1" y="9" width="10" height="2" rx="1" fill="currentColor" opacity="0.2" />
                    </svg>
                    {t}
                  </div>
                ))}
                <div className="mt-4 p-3 text-[10px] font-[var(--font-mono)] uppercase tracking-widest text-[var(--fg-subtle)]">
                  Views
                </div>
                {["team_summary", "budget_report"].map((v) => (
                  <div key={v} className="mx-2 px-2.5 py-1.5 text-[12px] font-[var(--font-mono)] text-[var(--fg-subtle)] flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0 opacity-40">
                      <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                    {v}
                  </div>
                ))}
              </div>

              {/* Main area */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Toolbar */}
                <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)]">
                  <button className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${done ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)] text-[var(--fg-muted)] border border-[var(--border)]"}`}>
                    <svg width="8" height="10" viewBox="0 0 8 10" fill="currentColor"><polygon points="0,0 8,5 0,10" /></svg>
                    Run
                  </button>
                  <div className="h-4 w-px bg-[var(--border-subtle)]" />
                  <button className="text-xs text-[var(--fg-subtle)] hover:text-[var(--fg-muted)]">Format</button>
                  <button className="text-xs text-[var(--fg-subtle)] hover:text-[var(--fg-muted)]">Explain</button>
                  <span className="ml-auto text-[10px] font-[var(--font-mono)] text-[var(--fg-subtle)]">
                    {done ? "5 rows · 1.8ms" : ""}
                  </span>
                </div>

                {/* Editor */}
                <div className="editor-bg flex-none border-b border-[var(--border-subtle)] p-4 font-[var(--font-mono)] text-[12px] leading-[20px] min-h-[180px] relative">
                  <div className="flex gap-4">
                    <div className="text-[var(--fg-subtle)] text-right select-none w-5 shrink-0 text-[11px] leading-[20px]">
                      {Array.from({ length: lineCount }, (_, i) => (
                        <div key={i}>{i + 1}</div>
                      ))}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <pre className="whitespace-pre-wrap">{tokenize(typed)}</pre>
                      {!done && (
                        <span className="inline-block w-[2px] h-[14px] bg-[var(--accent)] animate-pulse ml-px align-middle" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Results */}
                <div className={`flex-1 overflow-auto transition-all duration-700 ${done ? "opacity-100" : "opacity-0"}`}>
                  <table className="w-full text-left font-[var(--font-mono)] text-[12px]">
                    <thead>
                      <tr className="bg-[var(--surface-raised)]">
                        {["name", "department", "projects", "avg_salary"].map((h) => (
                          <th key={h} className="px-4 py-2 text-[11px] font-semibold text-[var(--fg-muted)] border-b border-r last:border-r-0 border-[var(--border-subtle)]">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {RESULT_ROWS.map((row, i) => (
                        <tr key={i} className="hover:bg-[var(--accent-muted)] transition-colors">
                          {row.map((cell, j) => (
                            <td key={j} className="px-4 py-1.5 text-[var(--fg-muted)] border-b border-r last:border-r-0 border-[var(--border-subtle)]">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-4 py-2 text-[10px] font-[var(--font-mono)] text-[var(--fg-subtle)] flex justify-between border-t border-[var(--border-subtle)]">
                    <span>5 rows</span>
                    <span>Execution: 1.8ms · Transfer: 0.2ms</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Trust strip ─── */}
        <div className="mt-16 text-center animate-fade d5" style={{ opacity: 0 }}>
          <p className="text-xs text-[var(--fg-subtle)] font-[var(--font-mono)] uppercase tracking-[0.15em] mb-4">
            Works with any PostgreSQL host
          </p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-[var(--fg-muted)]">
            {["PostgreSQL", "Supabase", "Neon", "AWS RDS", "Railway", "Render", "Fly.io", "DigitalOcean", "TimescaleDB"].map((name) => (
              <span key={name} className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-[var(--success)] opacity-60" />
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
