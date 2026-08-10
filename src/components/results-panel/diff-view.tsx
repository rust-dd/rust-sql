import { invoke } from "@tauri-apps/api/core";
import { Diff, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { type CellValue, decodeResult, encodeResult, encodeRow } from "@/lib/wire";

export function DiffView({
  pinnedColumns,
  pinnedRows,
  currentColumns,
  currentRows,
}: {
  pinnedColumns: string[];
  pinnedRows: CellValue[][];
  currentColumns: string[];
  currentRows: CellValue[][];
}) {
  const [diffResult, setDiffResult] = useState<{
    added: CellValue[][];
    removed: CellValue[][];
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

    // compute_diff compares rows as opaque strings, so the escaped encoding
    // round-trips through it unchanged while keeping NULL apart from "".
    const pinnedPacked = encodeResult(pinnedColumns, pinnedRows);
    const currentPacked = encodeResult(currentColumns, currentRows);

    invoke<[string, string, number]>("compute_diff", {
      pinned_packed: pinnedPacked,
      current_packed: currentPacked,
    })
      .then(([addedPacked, removedPacked, unchangedCount]) => {
        // Both payloads carry a header line that decodeResult strips.
        setDiffResult({
          added: decodeResult(addedPacked).rows,
          removed: decodeResult(removedPacked).rows,
          unchangedCount,
        });
        setComputing(false);
      })
      .catch(() => {
        // Fallback: compute in JS if Rust command fails
        const pinnedSet = new Set(pinnedRows.map(encodeRow));
        const currentSet = new Set(currentRows.map(encodeRow));
        setDiffResult({
          added: currentRows.filter((r) => !pinnedSet.has(encodeRow(r))),
          removed: pinnedRows.filter((r) => !currentSet.has(encodeRow(r))),
          unchangedCount: currentRows.filter((r) => pinnedSet.has(encodeRow(r))).length,
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
