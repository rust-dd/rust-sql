import { Download, Github, ChevronDown } from "lucide-react";

export function Hero() {
  return (
    <section className="relative flex flex-col items-center justify-center px-6 pt-32 pb-20 text-center overflow-hidden">
      {/* Gradient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-3xl animate-fade-in-up">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/60 px-4 py-1.5 text-sm text-muted-foreground mb-8 backdrop-blur-sm">
          <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
          v1.1.0 — Now with SSH tunnels via russh
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
          The Modern
          <br />
          <span className="gradient-text">PostgreSQL Client</span>
        </h1>

        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Built with Rust and Tauri. Handles millions of rows without breaking a sweat.
          Zero-copy wire protocol, virtual pagination, and a focused interface that keeps SQL front and center.
        </p>

        <div className="flex items-center justify-center gap-4 mt-10">
          <a
            href="https://github.com/rust-dd/rust-sql/releases/latest"
            target="_blank"
            rel="noopener noreferrer"
            className="gradient-btn inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white"
          >
            <Download className="h-4 w-4" />
            Download
          </a>
          <a
            href="https://github.com/rust-dd/rust-sql"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/60 px-6 py-3 text-sm font-semibold text-foreground hover:bg-card transition-colors"
          >
            <Github className="h-4 w-4" />
            GitHub
          </a>
        </div>

        <a
          href="#demo"
          className="inline-flex items-center gap-1 mt-16 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Try it in your browser
          <ChevronDown className="h-4 w-4 animate-bounce" />
        </a>
      </div>
    </section>
  );
}
