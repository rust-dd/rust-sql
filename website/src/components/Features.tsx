import {
  Columns3,
  GitBranch,
  Key,
  Layers,
  Map,
  Search,
  Shield,
  Terminal,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";

/* ─── Narrative feature blocks (alternating layout) ─── */

interface NarrativeFeature {
  label: string;
  title: string;
  subtitle: string;
  description: string;
  visual: ReactNode;
  reverse?: boolean;
}

const narrativeFeatures: NarrativeFeature[] = [
  {
    label: "Editor",
    title: "Write SQL like code",
    subtitle: "Monaco editor with real IDE features",
    description:
      "Full autocomplete, syntax highlighting, formatting, snippets, and inline EXPLAIN. Run queries with Cmd+Enter, see results instantly in a WebGL-rendered canvas grid — zero DOM nodes per cell.",
    visual: <EditorVisual />,
  },
  {
    label: "Navigator",
    title: "See everything at a glance",
    subtitle: "Schema browser built for density",
    description:
      "Browse tables, views, materialized views, functions, triggers, indexes, constraints, and RLS policies. Click any foreign key value to jump to the referenced row. Cmd+K to search anything.",
    reverse: true,
    visual: <NavigatorVisual />,
  },
  {
    label: "Insights",
    title: "Understand your queries",
    subtitle: "Execution plans and live monitoring",
    description:
      "EXPLAIN visualizer renders plans as navigable trees with cost breakdowns. Live pg_stat_activity shows what's happening right now. PostGIS columns render directly on map tiles.",
    visual: <InsightsVisual />,
  },
];

/* ─── Compact feature grid ─── */

const compactFeatures = [
  { icon: <GitBranch className="h-4 w-4" />, name: "ERD diagrams", desc: "Auto-generated with FK lines" },
  { icon: <Terminal className="h-4 w-4" />, name: "Inline terminal", desc: "Built-in PTY, run anything" },
  { icon: <Columns3 className="h-4 w-4" />, name: "Query diff", desc: "Compare results side by side" },
  { icon: <Shield className="h-4 w-4" />, name: "SSH tunnels", desc: "Remote access without config" },
  { icon: <Key className="h-4 w-4" />, name: "FK navigation", desc: "Click to follow references" },
  { icon: <Map className="h-4 w-4" />, name: "PostGIS maps", desc: "Spatial data on live tiles" },
  { icon: <Zap className="h-4 w-4" />, name: "SIMD JSON", desc: "sonic-rs serialization" },
  { icon: <Layers className="h-4 w-4" />, name: "Workspaces", desc: "Save and restore tab groups" },
];

export function Features() {
  return (
    <section className="px-6 pt-24 pb-12" id="features">
      <div className="mx-auto max-w-[1080px]">

        {/* ─── Narrative feature blocks ─── */}
        {narrativeFeatures.map((feat) => (
          <div key={feat.label} className={`feature-block ${feat.reverse ? "reverse" : ""}`}>
            <div>
              <span className="section-label">{feat.label}</span>
              <h2 className="font-display text-[clamp(1.8rem,4vw,2.8rem)] mt-3">
                {feat.title}
              </h2>
              <p className="text-[var(--fg-muted)] mt-1 text-base font-medium">
                {feat.subtitle}
              </p>
              <p className="text-[var(--fg-muted)] mt-4 text-[15px] leading-relaxed max-w-md">
                {feat.description}
              </p>
            </div>
            <div>
              {feat.visual}
            </div>
          </div>
        ))}

        {/* ─── Compact feature grid ─── */}
        <div className="border-t border-[var(--border-subtle)] pt-16 pb-8">
          <div className="text-center mb-10">
            <span className="section-label">And everything else</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--border-subtle)] rounded-2xl overflow-hidden border border-[var(--border-subtle)]">
            {compactFeatures.map((feat) => (
              <div key={feat.name} className="bg-[var(--bg)] p-5 flex flex-col gap-2 hover:bg-[var(--accent-muted)] transition-colors">
                <div className="text-[var(--accent)]">{feat.icon}</div>
                <div className="text-sm font-semibold">{feat.name}</div>
                <div className="text-xs text-[var(--fg-muted)]">{feat.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Visuals ─── */

function EditorVisual() {
  return (
    <div className="product-frame">
      <div className="product-frame-titlebar">
        <div className="product-frame-dot bg-[#ff5f57]" />
        <div className="product-frame-dot bg-[#febc2e]" />
        <div className="product-frame-dot bg-[#28c840]" />
        <span className="flex-1 text-center text-[10px] text-[var(--fg-subtle)] font-[var(--font-mono)]">query editor</span>
      </div>
      {/* Mini editor mock */}
      <div className="editor-bg p-4 font-[var(--font-mono)] text-[11px] leading-5 border-b border-[var(--border-subtle)]">
        <div className="text-violet-400">SELECT <span className="text-sky-300/80">name</span>, <span className="text-sky-300/80">salary</span></div>
        <div className="text-violet-400">FROM <span className="text-emerald-400/80">employees</span></div>
        <div className="text-violet-400">WHERE <span className="text-sky-300/80">salary</span> <span className="text-zinc-400">&gt;</span> <span className="text-amber-300/80">100000</span></div>
        <div className="text-violet-400">ORDER BY <span className="text-sky-300/80">salary</span> DESC<span className="text-zinc-400">;</span></div>
      </div>
      {/* Grid preview */}
      <div className="overflow-hidden">
        <table className="w-full text-[11px] font-[var(--font-mono)]">
          <thead>
            <tr className="bg-[var(--surface-raised)]">
              {["name", "salary"].map((h) => (
                <th key={h} className="text-left px-3 py-1.5 text-[10px] text-[var(--fg-muted)] font-semibold border-b border-[var(--border-subtle)]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[["Alice Chen", "$142,000"], ["Bob Park", "$131,500"], ["Carol Wu", "$125,800"]].map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j} className="px-3 py-1 text-[var(--fg-muted)] border-b border-[var(--border-subtle)]">{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-3 py-1.5 text-[9px] font-[var(--font-mono)] text-[var(--fg-subtle)]">3 rows · 0.8ms</div>
      </div>
    </div>
  );
}

function NavigatorVisual() {
  const items = [
    { indent: 0, icon: "◆", label: "production", accent: true, badge: "connected" },
    { indent: 1, icon: "▸", label: "public" },
    { indent: 2, icon: "▪", label: "employees", count: "12 cols" },
    { indent: 2, icon: "▪", label: "departments", count: "6 cols" },
    { indent: 2, icon: "▪", label: "projects", count: "8 cols" },
    { indent: 2, icon: "◇", label: "team_summary", count: "view" },
    { indent: 1, icon: "▸", label: "auth" },
    { indent: 2, icon: "▪", label: "users", count: "9 cols" },
    { indent: 2, icon: "▪", label: "sessions", count: "5 cols" },
  ];

  return (
    <div className="product-frame">
      <div className="product-frame-titlebar">
        <div className="product-frame-dot bg-[#ff5f57]" />
        <div className="product-frame-dot bg-[#febc2e]" />
        <div className="product-frame-dot bg-[#28c840]" />
        <span className="flex-1 text-center text-[10px] text-[var(--fg-subtle)] font-[var(--font-mono)]">schema navigator</span>
      </div>
      <div className="p-2">
        {/* Search */}
        <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 mb-2">
          <Search className="h-3 w-3 text-[var(--fg-subtle)]" />
          <span className="text-xs text-[var(--fg-subtle)]">Search tables, views...</span>
          <span className="ml-auto text-[9px] text-[var(--fg-subtle)] font-[var(--font-mono)] border border-[var(--border)] rounded px-1">⌘K</span>
        </div>
        {/* Tree */}
        {items.map((item, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] font-[var(--font-mono)] ${
              item.accent ? "text-[var(--accent)]" : "text-[var(--fg-muted)]"
            } ${i === 2 ? "bg-[var(--accent-muted)]" : "hover:bg-[var(--accent-muted)]"} transition-colors`}
            style={{ paddingLeft: 8 + item.indent * 16 }}
          >
            <span className="text-[10px] opacity-50 w-3 text-center">{item.icon}</span>
            <span>{item.label}</span>
            {item.count && (
              <span className="ml-auto text-[9px] text-[var(--fg-subtle)]">{item.count}</span>
            )}
            {item.badge && (
              <span className="ml-auto flex items-center gap-1 text-[9px] text-[var(--success)]">
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {item.badge}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightsVisual() {
  const nodes = [
    { depth: 0, label: "Sort", time: "2.1ms", pct: 100 },
    { depth: 1, label: "Hash Join", time: "1.6ms", pct: 76 },
    { depth: 2, label: "Seq Scan on employees", time: "0.8ms", pct: 38 },
    { depth: 2, label: "Hash", time: "0.3ms", pct: 14 },
    { depth: 3, label: "Seq Scan on departments", time: "0.2ms", pct: 10 },
  ];

  return (
    <div className="product-frame">
      <div className="product-frame-titlebar">
        <div className="product-frame-dot bg-[#ff5f57]" />
        <div className="product-frame-dot bg-[#febc2e]" />
        <div className="product-frame-dot bg-[#28c840]" />
        <span className="flex-1 text-center text-[10px] text-[var(--fg-subtle)] font-[var(--font-mono)]">explain analyze</span>
      </div>
      <div className="p-4 font-[var(--font-mono)] text-[11px]">
        {nodes.map((n, i) => (
          <div key={i} className="flex items-center gap-3 py-1.5" style={{ paddingLeft: n.depth * 20 }}>
            <div
              className="h-5 w-5 rounded-md bg-[var(--accent-muted)] text-[var(--accent)] flex items-center justify-center text-[9px] font-bold shrink-0"
            >
              {i + 1}
            </div>
            <span className="text-[var(--fg)] font-medium">{n.label}</span>
            <span className="ml-auto text-[var(--fg-subtle)] text-[10px] shrink-0">{n.time}</span>
            <div className="w-16 h-1.5 rounded-full bg-[var(--border)] overflow-hidden shrink-0">
              <div
                className="h-full rounded-full bg-[var(--accent)]"
                style={{ width: `${n.pct}%`, opacity: 0.5 + (n.pct / 200) }}
              />
            </div>
          </div>
        ))}
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] text-[10px] text-[var(--fg-subtle)] flex gap-6">
          <span>Planning: 0.15ms</span>
          <span>Execution: 2.34ms</span>
        </div>
      </div>
    </div>
  );
}
