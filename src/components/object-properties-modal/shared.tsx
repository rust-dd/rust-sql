import { Check, Key, Link2, Loader2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/30 bg-gradient-to-br from-muted/40 to-muted/10 px-3 py-2.5 group hover:border-border/50 transition-colors",
        accent,
      )}
    >
      <div className="absolute top-0 right-0 w-12 h-12 bg-gradient-to-bl from-white/[0.02] to-transparent rounded-bl-full" />
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center h-6 w-6 rounded-md bg-background/50 text-muted-foreground shrink-0">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[9px] text-muted-foreground/60 uppercase tracking-widest font-medium">
            {label}
          </div>
          <div className="text-sm font-mono font-semibold text-foreground truncate leading-tight mt-0.5">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
      <span className="text-muted-foreground/70 text-[11px]">{label}</span>
      <span className="text-foreground text-[11px] font-medium text-right">{value}</span>
    </div>
  );
}

export function PropertySection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center h-5 w-5 rounded-md bg-muted/40 text-muted-foreground/60">
          {icon}
        </div>
        <span className="text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-widest">
          {title}
        </span>
        <div className="flex-1 h-px bg-border/30" />
      </div>
      {children}
    </div>
  );
}

export function ConstraintIcon({ type }: { type: string }) {
  if (type === "PRIMARY KEY") return <Key className="h-3 w-3 text-warning shrink-0" />;
  if (type === "FOREIGN KEY") return <Link2 className="h-3 w-3 text-blue-500 shrink-0" />;
  if (type === "UNIQUE") return <Shield className="h-3 w-3 text-blue-500 shrink-0" />;
  if (type === "CHECK") return <Check className="h-3 w-3 text-muted-foreground shrink-0" />;
  return <Link2 className="h-3 w-3 text-muted-foreground/50 shrink-0" />;
}

export function LoadingPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
        <Loader2 className="h-5 w-5 animate-spin relative" />
      </div>
      <span className="text-xs font-mono">Loading...</span>
    </div>
  );
}

export function formatTimestamp(ts: string): string {
  if (ts === "never") return "never";
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 2592000000) return `${Math.floor(diff / 86400000)}d ago`;
    return d.toLocaleDateString();
  } catch {
    return ts;
  }
}
