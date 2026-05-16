import { ArrowRight, Check, Columns3, Copy, FileCode, RefreshCw } from "lucide-react";
import { InfoRow, LoadingPlaceholder, PropertySection, StatCard } from "./shared";
import type { FunctionMeta } from "./types";

export function FunctionOverview({
  functionMeta,
  copyText,
  copied,
}: {
  functionMeta: FunctionMeta | null;
  copyText: (text: string, label: string) => void;
  copied: string | null;
}) {
  if (!functionMeta) return <LoadingPlaceholder />;
  return (
    <div className="space-y-4 py-3">
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          label="Language"
          value={functionMeta.language}
          icon={<FileCode className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Volatility"
          value={functionMeta.volatility}
          icon={<RefreshCw className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Returns"
          value={functionMeta.returnType}
          icon={<ArrowRight className="h-3.5 w-3.5" />}
        />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono px-1">
        <InfoRow
          label="Security"
          value={functionMeta.securityDefiner ? "SECURITY DEFINER" : "SECURITY INVOKER"}
        />
        <InfoRow
          label="Strict"
          value={functionMeta.isStrict ? "YES (RETURNS NULL ON NULL INPUT)" : "NO"}
        />
        <InfoRow label="Est. Cost" value={functionMeta.estimatedCost} />
        <InfoRow label="Est. Rows" value={functionMeta.estimatedRows} />
      </div>
      {functionMeta.arguments && (
        <PropertySection title="Arguments" icon={<Columns3 className="h-3.5 w-3.5" />}>
          <div className="rounded-xl bg-[hsl(var(--background))] border border-border/30 px-3 py-2 text-[11px] font-mono text-foreground/90">
            {functionMeta.arguments}
          </div>
        </PropertySection>
      )}
      <PropertySection title="Source Code" icon={<FileCode className="h-3.5 w-3.5" />}>
        <div className="relative">
          <button
            type="button"
            onClick={() => copyText(functionMeta.source, "source")}
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground z-10"
            title="Copy source"
          >
            {copied === "source" ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          <pre className="rounded-xl bg-[hsl(var(--background))] border border-border/30 p-4 text-[11px] font-mono text-foreground/90 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[250px] selection:bg-primary/20">
            {functionMeta.source}
          </pre>
        </div>
      </PropertySection>
    </div>
  );
}
