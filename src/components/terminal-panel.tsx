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
        background: "hsl(250, 15%, 10%)",
        foreground: "hsl(250, 10%, 88%)",
        cursor: "hsl(260, 70%, 65%)",
        cursorAccent: "hsl(250, 15%, 10%)",
        selectionBackground: "hsla(260, 70%, 60%, 0.3)",
        black: "#16141f",
        red: "#ef4444",
        green: "#34d399",
        yellow: "#fbbf24",
        blue: "#818cf8",
        magenta: "#c084fc",
        cyan: "#22d3ee",
        white: "#e2e0eb",
        brightBlack: "#6b6880",
        brightRed: "#f87171",
        brightGreen: "#6ee7b7",
        brightYellow: "#fde68a",
        brightBlue: "#a5b4fc",
        brightMagenta: "#d8b4fe",
        brightCyan: "#67e8f9",
        brightWhite: "#f5f3ff",
      };
    }
    return {
      background: "#faf9ff",
      foreground: "#1a1830",
      cursor: "hsl(260, 70%, 50%)",
      cursorAccent: "#faf9ff",
      selectionBackground: "rgba(120, 80, 220, 0.15)",
      black: "#1a1830",
      red: "#dc2626",
      green: "#16a34a",
      yellow: "#ca8a04",
      blue: "#4f46e5",
      magenta: "#9333ea",
      cyan: "#0891b2",
      white: "#f5f3ff",
      brightBlack: "#8b85a0",
      brightRed: "#ef4444",
      brightGreen: "#22c55e",
      brightYellow: "#eab308",
      brightBlue: "#6366f1",
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
      lineHeight: 1.3,
      theme: getTermTheme(),
      cursorBlink: true,
      cursorStyle: "bar",
      allowProposedApi: true,
      scrollback: 5000,
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
      className="flex-1 min-h-0 overflow-hidden px-2 py-1"
      style={{ backgroundColor: theme === "dark" ? "hsl(250, 15%, 10%)" : "#faf9ff" }}
    />
  );
}
