import {
  ArrowRight,
  Download,
  Github,
} from "lucide-react";

const featureStrip = [
  "Zero-copy results",
  "Virtual pagination",
  "Explain plans",
  "Schema navigator",
];

const notes = [
  {
    label: "Query flow",
    text: "Write, inspect, rerun, compare.",
  },
  {
    label: "Surface density",
    text: "More signal, less admin-panel foam.",
  },
  {
    label: "Runtime",
    text: "Rust + Tauri, built to stay sharp.",
  },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pb-24 pt-40">
      <div className="pointer-events-none absolute left-[16%] top-10 h-[380px] w-[380px] rounded-full bg-primary/12 blur-[130px]" />
      <div className="pointer-events-none absolute right-[8%] top-24 h-[320px] w-[320px] rounded-full bg-[var(--page-glow-secondary)] blur-[150px]" />

      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="animate-fade-in-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/40 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            v1.1.0 - desktop-grade PostgreSQL client
          </div>

          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.12fr)_300px] lg:items-end">
            <div className="max-w-4xl">
            <p className="section-label">
              A calmer way to work with Postgres
            </p>

            <h1 className="font-display mt-5 text-[3.7rem] leading-[0.9] md:text-[6.8rem]">
              A PostgreSQL
              <br />
              client that
              <br />
              finally stops
              <br />
              <span className="gradient-text">shouting at you.</span>
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-[1.28rem]">
              RSQL focuses on the query loop itself: faster feedback, denser surfaces,
              and a PostgreSQL client that feels edited instead of accumulated.
            </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
                <a
                  href="https://github.com/rust-dd/rust-sql/releases/latest"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gradient-btn inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white"
                >
                  <Download className="h-4 w-4" />
                  Download
                </a>
                <a
                  href="https://github.com/rust-dd/rust-sql"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-chip inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-foreground"
                >
                  <Github className="h-4 w-4" />
                  GitHub
                </a>
                <a
                  href="#demo"
                  className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                  Try the browser sandbox
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>

            <aside className="lg:pb-3">
              <div className="rule" />
              <div className="mt-6 space-y-5">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                    Product stance
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Designed to feel quieter, faster, and more intentional than legacy admin tools.
                  </p>
                </div>
                <div className="space-y-2">
                  {featureStrip.map((item) => (
                    <div key={item} className="flex items-center justify-between gap-3 border-b border-border/35 pb-2 text-sm">
                      <span>{item}</span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        ready
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>

          <div className="mt-12 grid gap-3 border-t border-border/40 pt-6 sm:grid-cols-3">
            {notes.map((note) => (
              <div key={note.label} className="pr-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  {note.label}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-foreground/88">
                  {note.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
