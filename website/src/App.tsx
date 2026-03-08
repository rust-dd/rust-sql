import { useEffect, useState } from "react";
import { Hero } from "@/components/Hero";
import { Features } from "@/components/Features";
import { Demo } from "@/components/Demo";
import { Github, Download, Moon, Sun } from "lucide-react";

const THEME_STORAGE_KEY = "rsql-website-theme";

type Theme = "dark" | "light";

function getInitialTheme(): Theme {
  if (typeof document !== "undefined") {
    const documentTheme = document.documentElement.dataset.theme;
    if (documentTheme === "light" || documentTheme === "dark") {
      return documentTheme;
    }
  }

  if (typeof window === "undefined") {
    return "dark";
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function App() {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return (
    <div className="page-shell min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/30">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 px-6 h-14">
          <a href="/" className="font-mono font-bold text-lg tracking-tight">
            <span className="gradient-text">RSQL</span>
          </a>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#demo" className="hover:text-foreground transition-colors">Demo</a>
            <a
              href="https://github.com/rust-dd/rust-sql"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors inline-flex items-center gap-1.5"
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              className="relative inline-flex h-9 w-[4.5rem] items-center justify-between rounded-full border border-border/70 bg-card/70 px-2.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <span
                className={`absolute top-1 h-7 w-7 rounded-full bg-primary/12 transition-transform duration-300 ${
                  theme === "light" ? "translate-x-0" : "translate-x-9"
                }`}
              />
              <Sun
                className={`relative z-10 h-3.5 w-3.5 transition-colors ${
                  theme === "light" ? "text-primary" : "text-muted-foreground/70"
                }`}
              />
              <Moon
                className={`relative z-10 h-3.5 w-3.5 transition-colors ${
                  theme === "dark" ? "text-primary" : "text-muted-foreground/70"
                }`}
              />
            </button>
            <a
              href="https://github.com/rust-dd/rust-sql/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
              className="gradient-btn rounded-md px-4 py-1.5 text-xs font-semibold text-white inline-flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Download</span>
            </a>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <Hero />
        <Features />
        <Demo />
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span className="font-mono">
            <span className="gradient-text font-bold">RSQL</span> — Open source PostgreSQL client
          </span>
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/rust-dd/rust-sql"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors inline-flex items-center gap-1.5"
            >
              <Github className="h-4 w-4" />
              Source Code
            </a>
            <a
              href="https://github.com/rust-dd/rust-sql/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Releases
            </a>
            <a
              href="https://github.com/rust-dd/rust-sql/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Issues
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
