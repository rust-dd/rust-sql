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
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/45 bg-background/62 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-6">
          <a href="/" className="flex items-center gap-3">
            <span className="font-mono text-lg font-bold tracking-tight">
              <span className="gradient-text">RSQL</span>
            </span>
            <span className="hidden text-[12px] text-muted-foreground md:inline">
              PostgreSQL Workbench
            </span>
          </a>
          <nav className="hidden md:flex items-center gap-6 text-[13px] text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#demo" className="hover:text-foreground transition-colors">Sandbox</a>
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
              className="link-chip inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
            <a
              href="https://github.com/rust-dd/rust-sql/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
              className="gradient-btn inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold text-white"
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

      <footer className="px-6 pb-10 pt-4">
        <div className="mx-auto max-w-6xl border-t border-border/50 pt-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <span className="font-mono text-lg font-bold tracking-tight">
                <span className="gradient-text">RSQL</span>
              </span>
              <span className="text-sm text-muted-foreground">
                Open source PostgreSQL client
              </span>
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <a
                href="https://github.com/rust-dd/rust-sql"
                target="_blank"
                rel="noopener noreferrer"
                className="link-chip rounded-full px-4 py-2.5"
              >
                Source Code
              </a>
              <a
                href="https://github.com/rust-dd/rust-sql/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="link-chip rounded-full px-4 py-2.5"
              >
                Releases
              </a>
              <a
                href="https://github.com/rust-dd/rust-sql/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="link-chip rounded-full px-4 py-2.5"
              >
                Issues
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
