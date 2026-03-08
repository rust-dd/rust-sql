import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { DriverFactory } from "@/lib/database-driver";
import { useProjectStore } from "@/stores/project-store";
import { open } from "@tauri-apps/plugin-dialog";
import { FileUp, ArrowRight, Check, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CSVImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  schema: string;
  table: string;
  tableColumns: string[];
}

export function CSVImportModal({ open: isOpen, onOpenChange, projectId, schema, table, tableColumns }: CSVImportModalProps) {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const projects = useProjectStore((s) => s.projects);

  const pickFile = useCallback(async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "CSV", extensions: ["csv", "tsv", "txt"] }],
    });
    if (!selected) return;

    const path = typeof selected === "string" ? selected : selected;
    setFilePath(path);
    setResult(null);

    try {
      const d = projects[projectId];
      if (!d) return;
      const driver = DriverFactory.getDriver(d.driver);
      const [headers, rows] = await driver.csvPreview!(path);
      setCsvHeaders(headers);
      setPreviewRows(rows);

      // Auto-map columns by name match
      const autoMapping: Record<number, string> = {};
      headers.forEach((h, i) => {
        const match = tableColumns.find(
          (tc) => tc.toLowerCase() === h.toLowerCase()
        );
        if (match) autoMapping[i] = match;
      });
      setMapping(autoMapping);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setResult({ success: false, message });
    }
  }, [projectId, projects, tableColumns]);

  const handleImport = useCallback(async () => {
    if (!filePath) return;
    const columnMapping: [number, string][] = Object.entries(mapping)
      .filter(([, v]) => v !== "")
      .map(([k, v]) => [Number(k), v]);

    if (columnMapping.length === 0) {
      setResult({ success: false, message: "Map at least one column" });
      return;
    }

    setImporting(true);
    setResult(null);
    try {
      const d = projects[projectId];
      if (!d) return;
      const driver = DriverFactory.getDriver(d.driver);
      const count = await driver.csvImport!(projectId, filePath, schema, table, columnMapping);
      setResult({ success: true, message: `Successfully imported ${count.toLocaleString()} rows` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setResult({ success: false, message });
    } finally {
      setImporting(false);
    }
  }, [filePath, mapping, projectId, schema, table, projects]);

  const handleClose = (v: boolean) => {
    if (!importing) {
      setFilePath(null);
      setCsvHeaders([]);
      setPreviewRows([]);
      setMapping({});
      setResult(null);
      onOpenChange(v);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-4 w-4 text-primary" /> Import CSV
          </DialogTitle>
          <DialogDescription>
            Import data into <span className="font-mono text-foreground">{schema}.{table}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-5 space-y-4">
          {/* File picker */}
          <Button variant="outline" onClick={pickFile} disabled={importing} className="w-full justify-center gap-2 font-mono text-xs">
            <FileUp className="h-3.5 w-3.5" />
            {filePath ? filePath.split("/").pop() : "Choose CSV file..."}
          </Button>

          {/* Preview */}
          {csvHeaders.length > 0 && (
            <div className="rounded-xl border border-border/40 overflow-hidden">
              <div className="overflow-x-auto max-h-[200px]">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="bg-muted/30">
                      {csvHeaders.map((h, i) => (
                        <th key={i} className="px-3 py-1.5 text-left text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, ri) => (
                      <tr key={ri} className="border-t border-border/20">
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-1 whitespace-nowrap max-w-[200px] truncate">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Column mapping */}
          {csvHeaders.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Column Mapping</div>
              <div className="grid gap-1.5 max-h-[200px] overflow-y-auto">
                {csvHeaders.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs font-mono">
                    <span className="w-[140px] truncate text-muted-foreground" title={h}>{h}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                    <select
                      value={mapping[i] ?? ""}
                      onChange={(e) => setMapping((m) => ({ ...m, [i]: e.target.value }))}
                      className="flex-1 bg-input/80 border border-border/50 rounded-lg px-2 py-1 text-xs font-mono text-foreground"
                    >
                      <option value="">-- skip --</option>
                      {tableColumns.map((col) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Result message */}
          {result && (
            <div className={cn(
              "flex items-center gap-2 text-xs font-mono px-3 py-2 rounded-lg",
              result.success ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
            )}>
              {result.success ? <Check className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
              {result.message}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => handleClose(false)} disabled={importing} className="font-mono text-xs">
              {result?.success ? "Done" : "Cancel"}
            </Button>
            {!result?.success && (
              <Button
                variant="gradient"
                onClick={handleImport}
                disabled={importing || !filePath || csvHeaders.length === 0}
                className="font-mono text-xs gap-2"
              >
                {importing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Import
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
