import { Check, X, Minus } from "lucide-react";

type S = "yes" | "no" | "partial";

interface Row {
  feature: string;
  rsql: S; pgadmin: S; dbeaver: S; datagrip: S; tableplus: S;
  note?: string;
}

const rows: Row[] = [
  { feature: "Monaco editor + autocomplete", rsql: "yes", pgadmin: "partial", dbeaver: "partial", datagrip: "yes", tableplus: "partial" },
  { feature: "Canvas-based result grid", rsql: "yes", pgadmin: "no", dbeaver: "no", datagrip: "no", tableplus: "no", note: "Zero DOM nodes per cell" },
  { feature: "EXPLAIN plan visualizer", rsql: "yes", pgadmin: "yes", dbeaver: "yes", datagrip: "partial", tableplus: "no" },
  { feature: "ERD diagrams", rsql: "yes", pgadmin: "yes", dbeaver: "yes", datagrip: "yes", tableplus: "no" },
  { feature: "Schema navigator", rsql: "yes", pgadmin: "yes", dbeaver: "yes", datagrip: "yes", tableplus: "yes" },
  { feature: "PostGIS map view", rsql: "yes", pgadmin: "no", dbeaver: "yes", datagrip: "no", tableplus: "no" },
  { feature: "FK click-navigation", rsql: "yes", pgadmin: "no", dbeaver: "partial", datagrip: "yes", tableplus: "no" },
  { feature: "Built-in terminal", rsql: "yes", pgadmin: "no", dbeaver: "no", datagrip: "yes", tableplus: "no" },
  { feature: "Schema diff tool", rsql: "yes", pgadmin: "no", dbeaver: "partial", datagrip: "yes", tableplus: "no", note: "DBeaver: Pro only" },
  { feature: "Command palette", rsql: "yes", pgadmin: "no", dbeaver: "no", datagrip: "yes", tableplus: "yes" },
  { feature: "SSH tunnels", rsql: "yes", pgadmin: "yes", dbeaver: "yes", datagrip: "yes", tableplus: "yes" },
  { feature: "CSV/JSON export", rsql: "yes", pgadmin: "yes", dbeaver: "yes", datagrip: "yes", tableplus: "partial" },
  { feature: "Dark mode", rsql: "yes", pgadmin: "yes", dbeaver: "yes", datagrip: "yes", tableplus: "yes" },
  { feature: "Cross-platform", rsql: "yes", pgadmin: "yes", dbeaver: "yes", datagrip: "yes", tableplus: "yes" },
];

const tools = [
  { key: "rsql" as const, name: "RSQL", highlight: true },
  { key: "pgadmin" as const, name: "pgAdmin" },
  { key: "dbeaver" as const, name: "DBeaver" },
  { key: "datagrip" as const, name: "DataGrip" },
  { key: "tableplus" as const, name: "TablePlus" },
];

const pricing = [
  { tool: "RSQL", price: "Free", detail: "Open source, forever", highlight: true },
  { tool: "pgAdmin", price: "Free", detail: "Open source" },
  { tool: "DBeaver", price: "$0 / $250", detail: "Community / Pro per yr" },
  { tool: "DataGrip", price: "$229", detail: "Per year" },
  { tool: "TablePlus", price: "$99", detail: "One-time, 1 device" },
];

const scoreCard = [
  { label: "Binary size", rsql: "~20 MB", pgadmin: "~180 MB", dbeaver: "~200 MB", datagrip: "~600 MB", tableplus: "~40 MB" },
  { label: "Grid tech", rsql: "Canvas", pgadmin: "DOM", dbeaver: "SWT", datagrip: "Swing", tableplus: "Native" },
  { label: "Runtime", rsql: "System WebView", pgadmin: "Python + browser", dbeaver: "JVM (Java 21)", datagrip: "JVM", tableplus: "Native" },
];

function Icon({ s }: { s: S }) {
  if (s === "yes") return <Check className="h-4 w-4 text-[var(--success)]" />;
  if (s === "partial") return <Minus className="h-4 w-4 text-amber-400/60" />;
  return <X className="h-4 w-4 text-[var(--fg-subtle)]" />;
}

export function Comparison() {
  return (
    <section className="px-6 py-24" id="comparison">
      <div className="mx-auto max-w-[1080px]">
        <div className="divider mb-16" />

        <div className="mb-12 max-w-lg">
          <span className="section-label">Comparison</span>
          <h2 className="font-display text-[clamp(1.8rem,4vw,2.8rem)] mt-3">
            How RSQL stacks up
          </h2>
          <p className="text-[var(--fg-muted)] mt-3 text-[15px] leading-relaxed">
            Feature-by-feature against the most popular PostgreSQL tools.
          </p>
        </div>

        {/* ─── Feature table ─── */}
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full min-w-[700px] text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left py-3 pr-4 text-[var(--fg-muted)] font-normal text-xs">Feature</th>
                {tools.map((t) => (
                  <th
                    key={t.key}
                    className={`py-3 px-2 text-center text-xs font-semibold w-[100px] ${
                      t.highlight ? "accent-text" : "text-[var(--fg-muted)]"
                    }`}
                  >
                    {t.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.feature} className="border-t border-[var(--border-subtle)] hover:bg-[var(--accent-muted)] transition-colors">
                  <td className="py-2.5 pr-4 text-[var(--fg)]">
                    {row.feature}
                    {row.note && (
                      <span className="ml-2 text-[10px] text-[var(--fg-subtle)] font-[var(--font-mono)]">
                        {row.note}
                      </span>
                    )}
                  </td>
                  {tools.map((t) => (
                    <td
                      key={t.key}
                      className={`py-2.5 px-2 text-center ${t.highlight ? "bg-[var(--accent-muted)]" : ""}`}
                    >
                      <div className="flex justify-center">
                        <Icon s={row[t.key]} />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ─── Pricing row ─── */}
        <div className="mt-8 overflow-x-auto -mx-6 px-6">
          <table className="w-full min-w-[700px] text-sm border-collapse">
            <tbody>
              <tr className="border-t-2 border-[var(--border)]">
                <td className="py-4 pr-4 font-semibold">Price</td>
                {pricing.map((p) => (
                  <td
                    key={p.tool}
                    className={`py-4 px-2 text-center w-[100px] ${p.highlight ? "bg-[var(--accent-muted)]" : ""}`}
                  >
                    <div className={`text-base font-bold ${p.highlight ? "accent-text" : ""}`}>
                      {p.price}
                    </div>
                    <div className="text-[10px] text-[var(--fg-subtle)] font-[var(--font-mono)] mt-0.5">
                      {p.detail}
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* ─── Score card ─── */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-px bg-[var(--border-subtle)] rounded-2xl overflow-hidden border border-[var(--border-subtle)]">
          {scoreCard.map((s) => (
            <div key={s.label} className="bg-[var(--bg)] p-5">
              <div className="text-xs text-[var(--fg-subtle)] font-[var(--font-mono)] uppercase tracking-wider mb-3">
                {s.label}
              </div>
              <div className="space-y-2 text-sm">
                {tools.map((t) => (
                  <div key={t.key} className="flex items-center justify-between">
                    <span className={t.highlight ? "accent-text font-medium" : "text-[var(--fg-muted)]"}>
                      {t.name}
                    </span>
                    <span className={`font-[var(--font-mono)] text-xs ${t.highlight ? "text-[var(--fg)]" : "text-[var(--fg-subtle)]"}`}>
                      {s[t.key]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
