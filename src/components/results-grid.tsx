import { useRef, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useUIStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

interface ResultsGridProps {
  columns: string[];
  rows: string[][];
}

const ROW_HEIGHT = 32;
const OVERSCAN = 20;
const MIN_COL_WIDTH = 80;
const MAX_COL_WIDTH = 400;
const CHAR_WIDTH = 7.5;
const PADDING = 24;

export function ResultsGrid({ columns, rows }: ResultsGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const setSelectedRow = useUIStore((s) => s.setSelectedRow);
  const setViewMode = useUIStore((s) => s.setViewMode);

  const colWidths = useMemo(() => {
    const sampleRows = rows.slice(0, 100);
    return columns.map((col, colIdx) => {
      let maxLen = col.length;
      for (const row of sampleRows) {
        const cellLen = (row[colIdx] ?? "").length;
        if (cellLen > maxLen) maxLen = cellLen;
      }
      return Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, maxLen * CHAR_WIDTH + PADDING));
    });
  }, [columns, rows]);

  const totalWidth = colWidths.reduce((a, b) => a + b, 0);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  return (
    <div ref={parentRef} className="flex-1 overflow-auto min-h-0">
      <div style={{ minWidth: totalWidth }}>
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 flex bg-secondary" style={{ width: totalWidth }}>
          {columns.map((col, i) => (
            <div
              key={col}
              className="border-b border-r border-border px-3 py-2 text-left font-mono text-xs font-semibold text-secondary-foreground whitespace-nowrap overflow-hidden"
              style={{ width: colWidths[i], minWidth: colWidths[i] }}
            >
              {col}
            </div>
          ))}
        </div>

        {/* Virtualized Rows */}
        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <div
                key={virtualRow.index}
                className={cn(
                  "flex hover:bg-accent/50 transition-colors cursor-pointer",
                  virtualRow.index % 2 === 1 && "bg-muted/30",
                )}
                style={{
                  position: "absolute",
                  top: virtualRow.start,
                  height: ROW_HEIGHT,
                  width: totalWidth,
                }}
                onClick={() => {
                  setSelectedRow(virtualRow.index);
                  setViewMode("record");
                }}
              >
                {row.map((cell, j) => (
                  <div
                    key={j}
                    className="border-b border-r border-border px-3 py-1.5 font-mono text-xs text-foreground whitespace-nowrap overflow-hidden text-ellipsis"
                    style={{
                      width: colWidths[j],
                      minWidth: colWidths[j],
                      lineHeight: `${ROW_HEIGHT - 12}px`,
                    }}
                    title={cell}
                  >
                    {cell}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
