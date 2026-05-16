import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, Download } from "lucide-react";
import { exportResults, copyToClipboard, type ExportFormat } from "@/lib/export";

interface ToolbarExportProps {
  columns: string[];
  filteredRows: string[][];
  hasResult: boolean;
}

export function ToolbarExport({ columns, filteredRows, hasResult }: ToolbarExportProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const handleExport = (format: ExportFormat) => {
    if (!hasResult) return;
    exportResults(format, columns, filteredRows);
    setExportOpen(false);
  };

  const handleCopy = (format: ExportFormat) => {
    if (!hasResult) return;
    void copyToClipboard(format, columns, filteredRows);
    setExportOpen(false);
  };

  return (
    <div className="relative" ref={exportRef}>
      <button
        onClick={() => setExportOpen(!exportOpen)}
        className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      >
        <Download className="h-3 w-3" />
        Export
      </button>
      {exportOpen && createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setExportOpen(false)} />
          <div
            className="fixed w-52 rounded-md border border-border bg-popover shadow-md py-1"
            style={{
              zIndex: 9999,
              top: (() => { const r = exportRef.current?.getBoundingClientRect(); return r ? r.bottom + 4 : 0; })(),
              left: (() => { const r = exportRef.current?.getBoundingClientRect(); return r ? Math.max(0, r.right - 208) : 0; })(),
            }}
          >
            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Download
            </div>
            {(["csv", "json", "sql", "markdown", "xml"] as ExportFormat[]).map((fmt) => (
              <button
                key={fmt}
                onClick={() => handleExport(fmt)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-mono hover:bg-accent transition-colors"
              >
                <Download className="h-3 w-3 text-muted-foreground" />
                {fmt.toUpperCase()}
              </button>
            ))}
            <div className="border-t border-border my-1" />
            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Copy to clipboard
            </div>
            {(["csv", "json", "sql", "markdown"] as ExportFormat[]).map((fmt) => (
              <button
                key={`copy-${fmt}`}
                onClick={() => handleCopy(fmt)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-mono hover:bg-accent transition-colors"
              >
                <Copy className="h-3 w-3 text-muted-foreground" />
                {fmt.toUpperCase()}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
