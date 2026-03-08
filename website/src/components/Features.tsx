import {
  Activity,
  Cpu,
  Database,
  GitBranch,
  Network,
  Shield,
  Table,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";

const featureNotes: { icon: ReactNode; title: string; desc: string }[] = [
  {
    icon: <Zap className="h-5 w-5" />,
    title: "Monaco SQL editor",
    desc: "Autocomplete, formatting, and a tighter run / explain loop.",
  },
  {
    icon: <Table className="h-5 w-5" />,
    title: "Schema navigator",
    desc: "Compact browsing for tables, roles, extensions, and settings.",
  },
  {
    icon: <GitBranch className="h-5 w-5" />,
    title: "Explain tools",
    desc: "Execution plans that stay close to the query they belong to.",
  },
  {
    icon: <Activity className="h-5 w-5" />,
    title: "Performance monitor",
    desc: "Live activity, index usage, and database-level signals.",
  },
  {
    icon: <Shield className="h-5 w-5" />,
    title: "SSH tunnels",
    desc: "Remote database access without bolting on another client.",
  },
  {
    icon: <Database className="h-5 w-5" />,
    title: "Large result handling",
    desc: "Virtual pagination and dense result surfaces for heavy datasets.",
  },
];

const speedNotes: { icon: ReactNode; title: string; desc: string }[] = [
  {
    icon: <Zap className="h-5 w-5" />,
    title: "Packed binary IPC",
    desc: "Result data is packed with flat separators instead of nested JSON arrays.",
  },
  {
    icon: <Network className="h-5 w-5" />,
    title: "Dual connections",
    desc: "Query traffic and metadata loading stay on separate sockets.",
  },
  {
    icon: <Database className="h-5 w-5" />,
    title: "Server-side cursors",
    desc: "Large results stream in batches, with only nearby pages kept hot.",
  },
  {
    icon: <Cpu className="h-5 w-5" />,
    title: "SIMD JSON serialization",
    desc: "Command responses use sonic-rs and raw IPC responses instead of default serde_json.",
  },
  {
    icon: <Table className="h-5 w-5" />,
    title: "WebGL canvas grid",
    desc: "The results surface renders without a DOM node for every visible cell.",
  },
];

export function Features() {
  return (
    <section className="px-6 py-24" id="features">
      <div className="mx-auto max-w-6xl border-t border-border/45 pt-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.6fr)_minmax(0,1.4fr)]">
          <div>
            <p className="section-label mb-3">
              Selected Features
            </p>
            <h2 className="font-display text-[2.1rem] leading-[0.98] md:text-[2.9rem]">
              Built for real
              <br />
              Postgres work.
            </h2>
          </div>

          <div className="grid gap-x-10 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
            {featureNotes.map((feature) => (
              <article key={feature.title} className="flex gap-4">
                <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-14 grid gap-8 border-t border-border/45 pt-8 lg:grid-cols-[minmax(0,0.6fr)_minmax(0,1.4fr)]">
          <div>
            <p className="section-label mb-3">
              Performance Notes
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              A few concrete reasons the app feels faster than typical database tools.
            </p>
          </div>

          <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
            {speedNotes.map((note) => (
              <article key={note.title} className="flex gap-4">
                <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  {note.icon}
                </div>
                <div>
                  <h3 className="text-base font-semibold tracking-tight">{note.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{note.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
