import { Download, Github } from "lucide-react";

export function CTA() {
  return (
    <section className="px-6 py-28">
      <div className="mx-auto max-w-[1080px] text-center">
        <div className="divider mb-16" />

        <span className="section-label">Get started</span>

        <h2 className="font-display text-[clamp(2rem,5vw,3.5rem)] mt-4">
          Try RSQL today
        </h2>

        <p className="mx-auto mt-4 max-w-md text-base text-[var(--fg-muted)] leading-relaxed">
          Free, open source, no account needed. Available on macOS, Windows, and Linux.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <a
            href="https://github.com/rust-dd/rust-sql/releases/latest"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            <Download className="h-4 w-4" />
            Download RSQL
          </a>
          <a
            href="https://github.com/rust-dd/rust-sql"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            <Github className="h-4 w-4" />
            View source
          </a>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-[var(--fg-subtle)]">
          <span>macOS (Apple Silicon & Intel)</span>
          <span className="hidden sm:inline">·</span>
          <span>Windows (x64)</span>
          <span className="hidden sm:inline">·</span>
          <span>Linux (AppImage & deb)</span>
        </div>
      </div>
    </section>
  );
}
