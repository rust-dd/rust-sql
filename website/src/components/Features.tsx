import {
  Zap,
  Database,
  Activity,
  Layers,
  FileCode,
  Shield,
  Table,
  GitBranch,
} from "lucide-react";
import type { ReactNode } from "react";

const features: { icon: ReactNode; title: string; desc: string }[] = [
  {
    icon: <Zap className="h-5 w-5" />,
    title: "Zero-Copy Wire Protocol",
    desc: "Raw PostgreSQL wire protocol parsed directly into the UI grid. No ORM, no serialization overhead.",
  },
  {
    icon: <Database className="h-5 w-5" />,
    title: "Virtual Pagination",
    desc: "Server-side cursors handle millions of rows. Only visible pages stay in memory.",
  },
  {
    icon: <FileCode className="h-5 w-5" />,
    title: "Monaco SQL Editor",
    desc: "Full syntax highlighting, context-aware autocomplete, and one-click SQL formatting.",
  },
  {
    icon: <GitBranch className="h-5 w-5" />,
    title: "EXPLAIN Visualizer",
    desc: "Visual query execution plans from EXPLAIN ANALYZE with node-level timing breakdown.",
  },
  {
    icon: <Activity className="h-5 w-5" />,
    title: "Performance Monitor",
    desc: "Live pg_stat_activity, database stats, index usage, and table-level metrics.",
  },
  {
    icon: <Layers className="h-5 w-5" />,
    title: "ERD Diagrams",
    desc: "Auto-generated entity-relationship diagrams from your schema with foreign key edges.",
  },
  {
    icon: <Shield className="h-5 w-5" />,
    title: "SSH Tunnels",
    desc: "Pure Rust async SSH via russh. Connect securely to remote databases through bastion hosts.",
  },
  {
    icon: <Table className="h-5 w-5" />,
    title: "Schema Navigator",
    desc: "Compact object explorer for databases, schemas, tables, roles, and extensions without the legacy tooling feel.",
  },
];

export function Features() {
  return (
    <section className="px-6 py-24 max-w-6xl mx-auto" id="features">
      <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
        Everything you need
      </h2>
      <p className="text-center text-muted-foreground mb-16 max-w-xl mx-auto">
        A complete PostgreSQL toolkit — fast, secure, and built for developers who care about their tools.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {features.map((f) => (
          <div
            key={f.title}
            className="glass rounded-xl p-5 hover:-translate-y-0.5 transition-transform duration-200"
          >
            <div className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 text-primary mb-3">
              {f.icon}
            </div>
            <h3 className="font-semibold text-sm mb-1.5">{f.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
