import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useUIStore } from "@/stores/ui-store";
import "@xterm/xterm/css/xterm.css";

interface TerminalPanelProps {
  terminalId: string;
}

export function TerminalPanel({ terminalId }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const spawnedRef = useRef(false);
  const theme = useUIStore((s) => s.theme);

  const getTermTheme = useCallback(() => {
    if (theme === "dark") {
      return {
        background: "hsl(224, 20%, 10%)",
        foreground: "hsl(220, 15%, 85%)",
        cursor: "hsl(220, 70%, 55%)",
        cursorAccent: "hsl(224, 20%, 10%)",
        selectionBackground: "hsla(220, 70%, 55%, 0.3)",
        black: "#1a1a2e",
        red: "#ef4444",
        green: "#22c55e",
        yellow: "#eab308",
        blue: "#3b82f6",
        magenta: "#a855f7",
        cyan: "#06b6d4",
        white: "#e5e7eb",
        brightBlack: "#6b7280",
        brightRed: "#f87171",
        brightGreen: "#4ade80",
        brightYellow: "#fde047",
        brightBlue: "#60a5fa",
        brightMagenta: "#c084fc",
        brightCyan: "#22d3ee",
        brightWhite: "#f9fafb",
      };
    }
    return {
      background: "#ffffff",
      foreground: "#1a1a1a",
      cursor: "#3b82f6",
      cursorAccent: "#ffffff",
      selectionBackground: "rgba(59, 130, 246, 0.2)",
      black: "#1a1a1a",
      red: "#dc2626",
      green: "#16a34a",
      yellow: "#ca8a04",
      blue: "#2563eb",
      magenta: "#9333ea",
      cyan: "#0891b2",
      white: "#f5f5f5",
      brightBlack: "#9ca3af",
      brightRed: "#ef4444",
      brightGreen: "#22c55e",
      brightYellow: "#eab308",
      brightBlue: "#3b82f6",
      brightMagenta: "#a855f7",
      brightCyan: "#06b6d4",
      brightWhite: "#ffffff",
    };
  }, [theme]);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.2,
      theme: getTermTheme(),
      cursorBlink: true,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    // Spawn the PTY process
    if (!spawnedRef.current) {
      spawnedRef.current = true;
      const cols = term.cols;
      const rows = term.rows;

      invoke("terminal_spawn", { id: terminalId, cols, rows }).catch((err) => {
        term.writeln(`\r\nFailed to spawn terminal: ${err}\r\n`);
      });
    }

    // Listen for data from PTY
    const dataUnlisten = listen<string>(`terminal-data-${terminalId}`, (event) => {
      term.write(event.payload);
    });

    const exitUnlisten = listen(`terminal-exit-${terminalId}`, () => {
      term.writeln("\r\n[Process exited]");
    });

    // Send keystrokes to PTY
    const dataDisposable = term.onData((data) => {
      invoke("terminal_write", { id: terminalId, data }).catch(() => {});
    });

    // Handle resize
    const resizeObs = new ResizeObserver(() => {
      fitAddon.fit();
      const cols = term.cols;
      const rows = term.rows;
      invoke("terminal_resize", { id: terminalId, cols, rows }).catch(() => {});
    });
    resizeObs.observe(containerRef.current);

    return () => {
      dataDisposable.dispose();
      resizeObs.disconnect();
      dataUnlisten.then((fn) => fn());
      exitUnlisten.then((fn) => fn());
      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminalId]);

  // Update theme when it changes
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.theme = getTermTheme();
    }
  }, [getTermTheme]);

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 overflow-hidden p-1"
      style={{ backgroundColor: theme === "dark" ? "hsl(224, 20%, 10%)" : "#ffffff" }}
    />
  );
}
