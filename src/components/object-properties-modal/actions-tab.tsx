import { AlertTriangle, Check, Key, Loader2, Play, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ObjectType } from "./types";

export function ActionsContent({
  objectType,
  schema,
  name,
  actionResult,
  actionLoading,
  confirmAction,
  setConfirmAction,
  confirmInput,
  setConfirmInput,
  runAction,
  openTab,
  projectId,
  onOpenChange,
}: {
  objectType: ObjectType;
  schema: string;
  name: string;
  actionResult: { type: "success" | "error"; message: string } | null;
  actionLoading: boolean;
  confirmAction: string | null;
  setConfirmAction: (action: string | null) => void;
  confirmInput: string;
  setConfirmInput: (value: string) => void;
  runAction: (actionLabel: string) => Promise<void>;
  openTab: (projectId?: string, sql?: string) => void;
  projectId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const qualified = `"${schema}"."${name}"`;

  const actions: {
    label: string;
    icon: React.ReactNode;
    destructive?: boolean;
    confirm?: boolean;
    description: string;
  }[] = [];

  if (objectType === "table") {
    actions.push(
      {
        label: "ANALYZE",
        icon: <RefreshCw className="h-4 w-4" />,
        confirm: true,
        description: "Update table statistics for the query planner.",
      },
      {
        label: "VACUUM",
        icon: <RefreshCw className="h-4 w-4" />,
        confirm: true,
        description: "Reclaim storage occupied by dead tuples.",
      },
      {
        label: "VACUUM FULL",
        icon: <RefreshCw className="h-4 w-4" />,
        confirm: true,
        description: "Rewrite table to reclaim max space. Locks table exclusively.",
      },
      {
        label: "REINDEX",
        icon: <Key className="h-4 w-4" />,
        confirm: true,
        description: "Rebuild all indexes on this table.",
      },
      {
        label: "TRUNCATE",
        icon: <Trash2 className="h-4 w-4" />,
        destructive: true,
        confirm: true,
        description: "Remove all rows. Cannot be rolled back.",
      },
      {
        label: "DROP TABLE",
        icon: <Trash2 className="h-4 w-4" />,
        destructive: true,
        confirm: true,
        description: "Permanently delete this table and all its data.",
      },
    );
  } else if (objectType === "view") {
    actions.push(
      {
        label: "DROP VIEW",
        icon: <Trash2 className="h-4 w-4" />,
        destructive: true,
        confirm: true,
        description: "Permanently delete this view.",
      },
      {
        label: "DROP VIEW CASCADE",
        icon: <Trash2 className="h-4 w-4" />,
        destructive: true,
        confirm: true,
        description: "Drop view and all dependent objects.",
      },
    );
  } else if (objectType === "matview") {
    actions.push(
      {
        label: "REFRESH",
        icon: <RefreshCw className="h-4 w-4" />,
        confirm: true,
        description: "Refresh data by re-executing the query.",
      },
      {
        label: "REFRESH CONCURRENTLY",
        icon: <RefreshCw className="h-4 w-4" />,
        confirm: true,
        description: "Refresh without locking reads. Requires a unique index.",
      },
      {
        label: "DROP MATERIALIZED VIEW",
        icon: <Trash2 className="h-4 w-4" />,
        destructive: true,
        confirm: true,
        description: "Permanently delete this materialized view.",
      },
    );
  } else if (objectType === "function" || objectType === "trigger-function") {
    actions.push(
      {
        label: "DROP FUNCTION",
        icon: <Trash2 className="h-4 w-4" />,
        destructive: true,
        confirm: true,
        description: "Permanently delete this function.",
      },
      {
        label: "DROP FUNCTION CASCADE",
        icon: <Trash2 className="h-4 w-4" />,
        destructive: true,
        confirm: true,
        description: "Drop function and all dependent objects (triggers, etc.).",
      },
    );
  }

  return (
    <div className="space-y-3 py-3">
      {/* Quick open in tab */}
      {objectType === "table" && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Quick Queries
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => {
                openTab(projectId, `SELECT * FROM ${qualified} LIMIT 100;`);
                onOpenChange(false);
              }}
            >
              <Play className="h-3 w-3" /> SELECT TOP 100
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => {
                openTab(projectId, `SELECT COUNT(*) FROM ${qualified};`);
                onOpenChange(false);
              }}
            >
              <Play className="h-3 w-3" /> SELECT COUNT(*)
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => {
                openTab(projectId, `SELECT * FROM ${qualified} ORDER BY 1 DESC LIMIT 10;`);
                onOpenChange(false);
              }}
            >
              <Play className="h-3 w-3" /> Latest 10
            </Button>
          </div>
        </div>
      )}

      {/* Action result */}
      {actionResult && (
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-md text-xs font-mono",
            actionResult.type === "success"
              ? "bg-success/10 text-success"
              : "bg-destructive/10 text-destructive",
          )}
        >
          {actionResult.type === "success" ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5" />
          )}
          {actionResult.message}
        </div>
      )}

      {/* Action buttons */}
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
        Maintenance & Operations
      </div>
      <div className="space-y-2">
        {actions.map((action) => (
          <div
            key={action.label}
            className={cn(
              "rounded-xl border bg-muted/10 transition-all",
              confirmAction === action.label
                ? "border-border/40 bg-muted/20"
                : "border-border/25 hover:border-border/40 hover:bg-muted/20",
            )}
          >
            <div className="flex items-center gap-3 px-3.5 py-3">
              <span
                className={cn(
                  "shrink-0",
                  action.destructive ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {action.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    "text-xs font-mono font-medium",
                    action.destructive && "text-destructive",
                  )}
                >
                  {action.label}
                </div>
                <div className="text-[11px] text-muted-foreground">{action.description}</div>
              </div>
              {confirmAction !== action.label && (
                <Button
                  variant={action.destructive ? "ghost" : "outline"}
                  size="sm"
                  className={cn(
                    "h-7 px-3 text-xs shrink-0",
                    action.destructive && "text-destructive hover:bg-destructive/10",
                  )}
                  disabled={actionLoading}
                  onClick={() => {
                    if (action.confirm) {
                      setConfirmAction(action.label);
                    } else {
                      void runAction(action.label);
                    }
                  }}
                >
                  Run
                </Button>
              )}
            </div>
            {confirmAction === action.label && (
              <div className="px-3.5 pb-3 flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    Type <span className="font-mono font-semibold text-foreground">{name}</span> to
                    confirm
                  </span>
                  <input
                    type="text"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    placeholder={name}
                    className="flex-1 h-7 px-2 text-xs font-mono bg-background border border-border/40 rounded-md outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/30"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 px-3 text-[11px] font-medium",
                    action.destructive
                      ? "text-destructive hover:bg-destructive/10"
                      : "text-foreground hover:bg-muted/50",
                  )}
                  disabled={actionLoading || confirmInput !== name}
                  onClick={() => void runAction(action.label)}
                >
                  {actionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px] text-muted-foreground"
                  onClick={() => setConfirmAction(null)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
