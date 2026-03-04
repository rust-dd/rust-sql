import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/ui-store";

interface ResultsRecordProps {
  columns: string[];
  rows: string[][];
}

export function ResultsRecord({ columns, rows }: ResultsRecordProps) {
  const selectedRow = useUIStore((s) => s.selectedRow);
  const setSelectedRow = useUIStore((s) => s.setSelectedRow);

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center p-4 text-muted-foreground">
        No row selected
      </div>
    );
  }

  const safeIndex = Math.min(selectedRow, rows.length - 1);

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedRow((i) => Math.max(0, i - 1))}
            disabled={safeIndex === 0}
          >
            Prev
          </Button>
          <span className="text-sm text-muted-foreground font-mono">
            Row {safeIndex + 1} of {rows.length.toLocaleString()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedRow((i) => Math.min(rows.length - 1, i + 1))}
            disabled={safeIndex >= rows.length - 1}
          >
            Next
          </Button>
        </div>
        <table className="w-full border-collapse font-mono text-xs">
          <tbody>
            {columns.map((col, idx) => (
              <tr key={col} className={idx % 2 === 1 ? "bg-muted/30" : ""}>
                <td className="w-1/3 border-b border-border px-3 py-2 font-semibold text-foreground whitespace-nowrap">
                  {col}
                </td>
                <td className="border-b border-border px-3 py-2 text-foreground">
                  {rows[safeIndex]?.[idx] ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
