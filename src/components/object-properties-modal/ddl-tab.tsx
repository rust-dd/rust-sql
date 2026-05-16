import { AlertTriangle, Check, Copy, FileCode, Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingPlaceholder } from "./shared";

export function DDLContent({
  ddl,
  ddlLoading,
  ddlError,
  copied,
  onCopy,
  onRetry,
  onOpenInTab,
}: {
  ddl: string | null;
  ddlLoading: boolean;
  ddlError: string | null;
  copied: string | null;
  onCopy: () => void;
  onRetry: () => void;
  onOpenInTab: () => void;
}) {
  if (ddlLoading) {
    return <LoadingPlaceholder />;
  }

  if (ddlError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
        <p className="text-sm text-destructive font-mono">{ddlError}</p>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onRetry}>
          <RefreshCw className="h-3 w-3" />
          Retry
        </Button>
      </div>
    );
  }

  if (!ddl) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
        <FileCode className="h-6 w-6 text-muted-foreground/30" />
        <span className="text-xs font-mono">No DDL available</span>
      </div>
    );
  }

  return (
    <div className="pt-3 flex-1 flex flex-col min-h-0">
      {/* Code editor style container */}
      <div className="rounded-xl border border-border/40 overflow-hidden bg-[hsl(var(--background))] flex-1 flex flex-col min-h-0">
        {/* Title bar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b border-border/30 shrink-0">
          <div className="flex items-center gap-2">
            <FileCode className="h-3 w-3 text-muted-foreground/50" />
            <span className="text-[10px] font-mono text-muted-foreground/60">DDL</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 text-[10px] px-2 text-muted-foreground hover:text-foreground"
              onClick={onOpenInTab}
            >
              <Play className="h-2.5 w-2.5" />
              Open in Tab
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 text-[10px] px-2 text-muted-foreground hover:text-foreground"
              onClick={onCopy}
            >
              {copied === "ddl" ? (
                <>
                  <Check className="h-2.5 w-2.5 text-success" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-2.5 w-2.5" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </div>
        <pre className="p-4 text-[11px] font-mono text-foreground/90 overflow-y-auto whitespace-pre-wrap leading-relaxed selection:bg-primary/20 flex-1 min-h-0">
          {ddl}
        </pre>
      </div>
    </div>
  );
}
