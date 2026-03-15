import { useEffect, useState } from "react";
import { Hero } from "@/components/Hero";
import { Features } from "@/components/Features";
import { Comparison } from "@/components/Comparison";
import { Benchmarks } from "@/components/Benchmarks";
import { Demo } from "@/components/Demo";
import { CTA } from "@/components/CTA";
import { Github, Download, Moon, Sun, Menu, X } from "lucide-react";

const THEME_KEY = "rsql-theme";
type Theme = "dark" | "light";

function getTheme(): Theme {
  if (typeof document !== "undefined") {
    const d = document.documentElement.dataset.theme;
    if (d === "light" || d === "dark") return d;
  }
  if (typeof window === "undefined") return "dark";
  const s = window.localStorage.getItem(THEME_KEY);
  if (s === "light" || s === "dark") return s;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

const nav = [
  { href: "#features", label: "Features" },
  { href: "#comparison", label: "Compare" },
  { href: "#benchmarks", label: "Performance" },
  { href: "#demo", label: "Sandbox" },
];

export function App() {
  const [theme, setTheme] = useState<Theme>(getTheme);
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--fg)" }}>
      {/* ─── Header ─── */}
      <header
        className="fixed inset-x-0 top-0 z-50 transition-all duration-300"
        style={{
          borderBottom: scrolled ? "1px solid var(--border-subtle)" : "1px solid transparent",
          background: scrolled ? "color-mix(in srgb, var(--bg) 85%, transparent)" : "transparent",
          backdropFilter: scrolled ? "blur(16px)" : "none",
        }}
      >
        <div className="mx-auto flex h-14 max-w-[1080px] items-center justify-between px-6">
          <a href="/" className="text-lg font-bold font-[var(--font-mono)] tracking-tight accent-text">
            RSQL
          </a>

          <nav className="hidden md:flex items-center gap-1 text-[13px]">
            {nav.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-lg px-3 py-1.5 transition-colors hover:bg-[var(--accent-muted)]"
                style={{ color: "var(--fg-muted)" }}
              >
                {l.label}
              </a>
            ))}
            <a
              href="https://github.com/rust-dd/rust-sql"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-3 py-1.5 transition-colors hover:bg-[var(--accent-muted)] inline-flex items-center gap-1.5"
              style={{ color: "var(--fg-muted)" }}
            >
              <Github className="h-3.5 w-3.5" />
              GitHub
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Theme"
              className="h-8 w-8 rounded-full flex items-center justify-center transition-colors hover:bg-[var(--accent-muted)]"
              style={{ color: "var(--fg-muted)" }}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <a
              href="https://github.com/rust-dd/rust-sql/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold"
              style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
            <button
              onClick={() => setMenu(!menu)}
              className="h-8 w-8 rounded-full flex items-center justify-center md:hidden"
              style={{ color: "var(--fg-muted)" }}
            >
              {menu ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {menu && (
          <div
            className="md:hidden px-6 py-3 animate-fade"
            style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--bg)" }}
          >
            {nav.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenu(false)}
                className="block rounded-lg px-3 py-2 text-sm"
                style={{ color: "var(--fg-muted)" }}
              >
                {l.label}
              </a>
            ))}
          </div>
        )}
      </header>

      {/* ─── Content ─── */}
      <main>
        <Hero />
        <Features />
        <Comparison />
        <Benchmarks />
        <Demo />
        <CTA />
      </main>

      {/* ─── Footer ─── */}
      <footer className="px-6 pb-10">
        <div className="mx-auto max-w-[1080px]">
          <div className="divider mb-8" />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="font-[var(--font-mono)] text-sm font-bold accent-text">RSQL</span>
              <span className="text-sm" style={{ color: "var(--fg-subtle)" }}>
                Open source PostgreSQL workbench
              </span>
            </div>
            <div className="flex gap-4 text-sm" style={{ color: "var(--fg-subtle)" }}>
              <a href="https://github.com/rust-dd/rust-sql" target="_blank" rel="noopener noreferrer" className="hover:underline">Source</a>
              <a href="https://github.com/rust-dd/rust-sql/releases" target="_blank" rel="noopener noreferrer" className="hover:underline">Releases</a>
              <a href="https://github.com/rust-dd/rust-sql/issues" target="_blank" rel="noopener noreferrer" className="hover:underline">Issues</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
