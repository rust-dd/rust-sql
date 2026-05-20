import { transport } from "@/lib/transport";
import { Diff, Loader2 } from "lucide-react";
import { useRef, useState } from "react";

export function DiffView({
  pinnedColumns,
  pinnedRows,
  currentColumns,
  currentRows,
}: {
  pinnedColumns: string[];
  pinnedRows: string[][];
  currentColumns: string[];
  currentRows: string[][];
}) {
  const [diffResult, setDiffResult] = useState<{
    added: string[][];
    removed: string[][];
    unchangedCount: number;
  } | null>(null);
  const [computing, setComputing] = useState(false);

  const colsMatch =
    pinnedColumns.length === currentColumns.length &&
    pinnedColumns.every((c, i) => c === currentColumns[i]);

  // Compute diff in Rust backend for performance
  const prevKeyRef = useRef("");
  const diffKey = `${pinnedRows.length}:${currentRows.length}`;
  if (diffKey !== prevKeyRef.current && colsMatch) {
    prevKeyRef.current = diffKey;
    setComputing(true);
    setDiffResult(null);

    // Pack rows into the compact wire format for Rust
    const CELL_SEP = "\x1F";
    const ROW_SEP = "\x1E";
    const packRows = (columns: string[], rows: string[][]) => {
      const header = columns.join(CELL_SEP);
      if (rows.length === 0) return header;
      return header + ROW_SEP + rows.map((r) => r.join(CELL_SEP)).join(ROW_SEP);
    };

    const pinnedPacked = packRows(pinnedColumns, pinnedRows);
    const currentPacked = packRows(currentColumns, currentRows);

    transport
      .invoke<[string, string, number]>("compute_diff", {
        pinned_packed: pinnedPacked,
        current_packed: currentPacked,
      })
      .then(([addedPacked, removedPacked, unchangedCount]) => {
        const unpackRows = (packed: string): string[][] => {
          if (!packed) return [];
          const parts = packed.split(ROW_SEP);
          // Skip header (index 0)
          return parts.slice(1).map((r) => r.split(CELL_SEP));
        };
        setDiffResult({
          added: unpackRows(addedPacked),
          removed: unpackRows(removedPacked),
          unchangedCount,
        });
        setComputing(false);
      })
      .catch(() => {
        // Fallback: compute in JS if Rust command fails
        const pinnedSet = new Set(pinnedRows.map((r) => r.join(CELL_SEP)));
        const currentSet = new Set(currentRows.map((r) => r.join(CELL_SEP)));
        setDiffResult({
          added: currentRows.filter((r) => !pinnedSet.has(r.join(CELL_SEP))),
          removed: pinnedRows.filter((r) => !currentSet.has(r.join(CELL_SEP))),
          unchangedCount: currentRows.filter((r) => pinnedSet.has(r.join(CELL_SEP))).length,
        });
        setComputing(false);
      });
  }

  if (!colsMatch) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground gap-2 p-4">
        <Diff className="h-8 w-8" />
        <div className="text-sm font-mono">Column structures differ</div>
        <div className="text-xs">Pinned: {pinnedColumns.join(", ")}</div>
        <div className="text-xs">Current: {currentColumns.join(", ")}</div>
      </div>
    );
  }

  if (computing || !diffResult) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Computing diff...</span>
      </div>
    );
  }

  const { added, removed, unchangedCount } = diffResult;

  return (
    <div className="flex-1 overflow-auto p-4 font-mono text-xs">
      <div className="flex items-center gap-4 mb-3">
        <span className="flex items-center gap-1 text-success">
          <span className="h-2 w-2 rounded-full bg-success" /> +{added.length} added
        </span>
        <span className="flex items-center gap-1 text-destructive">
          <span className="h-2 w-2 rounded-full bg-destructive" /> -{removed.length} removed
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          ={unchangedCount} unchanged
        </span>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="border border-border px-2 py-1 text-left bg-secondary text-[10px] w-8" />
            {pinnedColumns.map((col) => (
              <th
                key={col}
                className="border border-border px-2 py-1 text-left bg-secondary text-[10px]"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {removed.map((row, i) => (
            <tr key={`r-${i}`} className="bg-destructive/10">
              <td className="border border-border px-2 py-0.5 text-destructive text-center">-</td>
              {row.map((cell, j) => (
                <td key={j} className="border border-border px-2 py-0.5 text-destructive">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {added.map((row, i) => (
            <tr key={`a-${i}`} className="bg-success/10">
              <td className="border border-border px-2 py-0.5 text-success text-center">+</td>
              {row.map((cell, j) => (
                <td key={j} className="border border-border px-2 py-0.5 text-success">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
