import { useState, useEffect, useCallback } from "react";
import { DriverFactory } from "@/lib/database-driver";
import { useProjectStore } from "@/stores/project-store";
import type { PgRole, TableGrant, DbGrant } from "@/types";
import { cn } from "@/lib/utils";
import { Shield, ShieldCheck, ShieldX, User, Users, Key, Database } from "lucide-react";

interface RolesPanelProps {
  projectId: string;
}

export function RolesPanel({ projectId }: RolesPanelProps) {
  const [roles, setRoles] = useState<PgRole[]>([]);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [tableGrants, setTableGrants] = useState<TableGrant[]>([]);
  const [dbGrants, setDbGrants] = useState<DbGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const projects = useProjectStore((s) => s.projects);

  const driver = projects[projectId] ? DriverFactory.getDriver(projects[projectId].driver) : null;

  useEffect(() => {
    if (!driver) return;
    setLoading(true);
    driver
      .loadRoles?.(projectId)
      .then((r) => {
        setRoles(r ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [driver, projectId]);

  const selectRole = useCallback(
    async (name: string) => {
      setSelectedRole(name);
      if (!driver) return;
      const [tg, dg] = await Promise.all([
        driver.loadTableGrants?.(projectId, name) ?? Promise.resolve([]),
        driver.loadDatabaseGrants?.(projectId, name) ?? Promise.resolve([]),
      ]);
      setTableGrants(tg);
      setDbGrants(dg);
    },
    [driver, projectId],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm font-mono">Loading roles...</div>
    );
  }

  const selected = roles.find((r) => r.name === selectedRole);

  return (
    <div className="flex h-full">
      {/* Role list */}
      <div className="w-[240px] border-r border-border/30 overflow-y-auto">
        <div className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Roles ({roles.length})
        </div>
        {roles.map((role) => (
          <button
            key={role.name}
            onClick={() => selectRole(role.name)}
            className={cn(
              "flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs font-mono transition-colors",
              selectedRole === role.name ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted/30",
            )}
          >
            {role.superuser ? (
              <ShieldCheck className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            ) : role.login ? (
              <User className="h-3.5 w-3.5 text-primary shrink-0" />
            ) : (
              <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            )}
            <span className="truncate">{role.name}</span>
            {role.superuser && (
              <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500">SUPER</span>
            )}
          </button>
        ))}
      </div>

      {/* Detail panel */}
      <div className="flex-1 overflow-y-auto p-4">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-muted-foreground/40 text-sm font-mono">
            Select a role
          </div>
        ) : (
          <div className="space-y-5 max-w-[800px]">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center",
                  selected.superuser ? "bg-amber-500/10" : "bg-primary/10",
                )}
              >
                {selected.superuser ? <ShieldCheck className="h-5 w-5 text-amber-500" /> : <Shield className="h-5 w-5 text-primary" />}
              </div>
              <div>
                <div className="font-mono font-semibold text-lg">{selected.name}</div>
                <div className="text-xs text-muted-foreground">
                  {selected.login ? "Login role" : "Group role"}
                  {selected.conn_limit >= 0 && ` (max ${selected.conn_limit} connections)`}
                </div>
              </div>
            </div>

            {/* Attributes */}
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Attributes</div>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { label: "SUPERUSER", active: selected.superuser },
                    { label: "CREATEDB", active: selected.create_db },
                    { label: "CREATEROLE", active: selected.create_role },
                    { label: "LOGIN", active: selected.login },
                    { label: "REPLICATION", active: selected.replication },
                    { label: "BYPASSRLS", active: selected.bypass_rls },
                  ] as const
                ).map(({ label, active }) => (
                  <span
                    key={label}
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono",
                      active
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "bg-muted/30 text-muted-foreground/40 border border-border/20",
                    )}
                  >
                    {active ? <ShieldCheck className="h-2.5 w-2.5" /> : <ShieldX className="h-2.5 w-2.5" />}
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Member of */}
            {selected.member_of.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Member of</div>
                <div className="flex flex-wrap gap-1.5">
                  {selected.member_of.map((g) => (
                    <button
                      key={g}
                      onClick={() => selectRole(g)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/50 text-xs font-mono hover:bg-accent transition-colors"
                    >
                      <Users className="h-2.5 w-2.5" /> {g}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Database grants */}
            {dbGrants.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Database Privileges
                </div>
                <div className="rounded-xl border border-border/30 overflow-hidden">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="bg-muted/20">
                        <th className="px-3 py-1.5 text-left text-muted-foreground font-medium">Database</th>
                        <th className="px-3 py-1.5 text-left text-muted-foreground font-medium">Privilege</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dbGrants.map((g, i) => (
                        <tr key={i} className="border-t border-border/15">
                          <td className="px-3 py-1">
                            <Database className="h-3 w-3 inline mr-1.5 text-muted-foreground/50" />
                            {g.database}
                          </td>
                          <td className="px-3 py-1">{g.privilege}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Table grants */}
            {tableGrants.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Table Privileges ({tableGrants.length})
                </div>
                <div className="rounded-xl border border-border/30 overflow-hidden max-h-[300px] overflow-y-auto">
                  <table className="w-full text-xs font-mono">
                    <thead className="sticky top-0 bg-muted/40 backdrop-blur-sm">
                      <tr>
                        <th className="px-3 py-1.5 text-left text-muted-foreground font-medium">Schema</th>
                        <th className="px-3 py-1.5 text-left text-muted-foreground font-medium">Table</th>
                        <th className="px-3 py-1.5 text-left text-muted-foreground font-medium">Privileges</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableGrants.map((g, i) => (
                        <tr key={i} className="border-t border-border/15">
                          <td className="px-3 py-1 text-muted-foreground">{g.schema}</td>
                          <td className="px-3 py-1">{g.table}</td>
                          <td className="px-3 py-1">
                            <div className="flex flex-wrap gap-1">
                              {g.privileges.map((p) => (
                                <span key={p} className="px-1.5 py-0.5 rounded bg-primary/5 text-[10px]">
                                  {p}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selected.valid_until && (
              <div className="text-xs text-muted-foreground font-mono">
                <Key className="h-3 w-3 inline mr-1" />
                Password valid until: {selected.valid_until}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
