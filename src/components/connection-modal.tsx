import type React from "react"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"
import { DRIVER_CONFIGS } from "@/lib/database-driver"
import { pgsqlTestConnection } from "@/tauri"
import type { DriverType, ProjectDetails } from "@/types"

interface ConnectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (connection: ConnectionConfig) => void
  editData?: { name: string; details: ProjectDetails } | null
}

export interface ConnectionConfig {
  id: string
  name: string
  driver: DriverType
  host: string
  port: string
  database: string
  username: string
  password: string
  ssl: boolean
  sshEnabled: boolean
  sshHost: string
  sshPort: string
  sshUser: string
  sshPassword: string
  sshKeyPath: string
}

const defaultForm: Omit<ConnectionConfig, "id"> = {
  name: "",
  driver: "PGSQL",
  host: "localhost",
  port: "5432",
  database: "",
  username: "",
  password: "",
  ssl: false,
  sshEnabled: false,
  sshHost: "",
  sshPort: "22",
  sshUser: "",
  sshPassword: "",
  sshKeyPath: "",
}

function parseConnectionString(url: string): Partial<Omit<ConnectionConfig, "id">> | null {
  try {
    // Handle postgresql:// and postgres:// schemes
    const normalized = url.trim().replace(/^postgres:\/\//, "postgresql://");
    if (!normalized.startsWith("postgresql://")) return null;
    const parsed = new URL(normalized);
    const params = parsed.searchParams;
    const ssl = params.get("sslmode") === "require" || params.get("sslmode") === "verify-full" || params.get("ssl") === "true";
    return {
      driver: "PGSQL",
      host: parsed.hostname || "localhost",
      port: parsed.port || "5432",
      database: parsed.pathname.replace(/^\//, "") || "",
      username: decodeURIComponent(parsed.username || ""),
      password: decodeURIComponent(parsed.password || ""),
      ssl,
    };
  } catch {
    return null;
  }
}

export function ConnectionModal({ open, onOpenChange, onSave, editData }: ConnectionModalProps) {
  const [formData, setFormData] = useState<Omit<ConnectionConfig, "id">>(defaultForm)
  const [connString, setConnString] = useState("")
  const [connStringError, setConnStringError] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    if (open && editData) {
      setFormData({
        name: editData.name,
        driver: editData.details.driver,
        host: editData.details.host,
        port: editData.details.port,
        database: editData.details.database,
        username: editData.details.username,
        password: editData.details.password,
        ssl: editData.details.ssl === "true",
        sshEnabled: editData.details.sshEnabled === "true",
        sshHost: editData.details.sshHost || "",
        sshPort: editData.details.sshPort || "22",
        sshUser: editData.details.sshUser || "",
        sshPassword: editData.details.sshPassword || "",
        sshKeyPath: editData.details.sshKeyPath || "",
      })
      setConnString("")
      setConnStringError(false)
      setTestResult(null)
    } else if (open && !editData) {
      setFormData(defaultForm)
      setConnString("")
      setConnStringError(false)
      setTestResult(null)
    }
  }, [open, editData])

  const handleConnStringPaste = (value: string) => {
    setConnString(value)
    setConnStringError(false)
    if (!value.trim()) return
    const parsed = parseConnectionString(value)
    if (parsed) {
      setFormData((prev) => ({ ...prev, ...parsed, name: prev.name || parsed.database || "" }))
    } else {
      setConnStringError(true)
    }
  }

  const isEditing = !!editData

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const key: [string, string, string, string, string, string] = [
        formData.username,
        formData.password,
        formData.database,
        formData.host,
        formData.port,
        formData.ssl ? "true" : "false",
      ]
      const version = await pgsqlTestConnection(key)
      setTestResult({ ok: true, message: version })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setTestResult({ ok: false, message: msg })
    } finally {
      setTesting(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const connection: ConnectionConfig = {
      ...formData,
      id: editData ? editData.name : `conn-${Date.now()}`,
    }
    onSave(connection)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border/50 rounded-xl sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-mono text-foreground">
            {isEditing ? "Edit Connection" : "New Connection"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            {isEditing ? "Update connection details" : "Add a new database connection"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="connString" className="font-mono text-xs text-foreground">
                Connection URL
              </Label>
              <Input
                id="connString"
                value={connString}
                onChange={(e) => handleConnStringPaste(e.target.value)}
                placeholder="postgresql://user:password@host:5432/database"
                className={`bg-input/80 border-border/50 text-foreground font-mono text-sm rounded-lg ${connStringError ? "border-destructive" : ""}`}
              />
              {connStringError && (
                <p className="text-destructive text-[11px] font-mono">Invalid connection URL format</p>
              )}
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/30" /></div>
                <div className="relative flex justify-center text-[10px]"><span className="bg-card px-2 text-muted-foreground">or fill in manually</span></div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="driver" className="font-mono text-xs text-foreground">
              Database Type
            </Label>
            <div className="w-full bg-input/80 border border-border/50 text-foreground font-mono text-sm rounded-lg px-3 py-2">
              {DRIVER_CONFIGS[formData.driver].name}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name" className="font-mono text-xs text-foreground">
              Connection Name
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="production-db"
              required
              disabled={isEditing}
              className="bg-input/80 border-border/50 text-foreground font-mono text-sm rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="host" className="font-mono text-xs text-foreground">
                Host
              </Label>
              <Input
                id="host"
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                placeholder="localhost"
                required
                className="bg-input/80 border-border/50 text-foreground font-mono text-sm rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port" className="font-mono text-xs text-foreground">
                Port
              </Label>
              <Input
                id="port"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                placeholder="5432"
                required
                className="bg-input/80 border-border/50 text-foreground font-mono text-sm rounded-lg"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="database" className="font-mono text-xs text-foreground">
              Database
            </Label>
            <Input
              id="database"
              value={formData.database}
              onChange={(e) => setFormData({ ...formData, database: e.target.value })}
              placeholder="mydb"
              required
              className="bg-input/80 border-border/50 text-foreground font-mono text-sm rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username" className="font-mono text-xs text-foreground">
              Username
            </Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="postgres"
              required
              className="bg-input/80 border-border/50 text-foreground font-mono text-sm rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="font-mono text-xs text-foreground">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="••••••••"
              className="bg-input/80 border-border/50 text-foreground font-mono text-sm rounded-lg"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ssl"
              checked={formData.ssl}
              onChange={(e) => setFormData({ ...formData, ssl: e.target.checked })}
              className="h-4 w-4 rounded border-border bg-input"
            />
            <Label htmlFor="ssl" className="font-mono text-xs text-foreground cursor-pointer">
              Use SSL
            </Label>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="sshEnabled"
                checked={formData.sshEnabled}
                onChange={(e) => setFormData({ ...formData, sshEnabled: e.target.checked })}
                className="h-4 w-4 rounded border-border bg-input"
              />
              <Label htmlFor="sshEnabled" className="font-mono text-xs text-foreground cursor-pointer">
                SSH Tunnel
              </Label>
            </div>
            {formData.sshEnabled && (
              <div className="space-y-3 rounded-lg border border-border/50 p-3 bg-muted/20">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="sshHost" className="font-mono text-[11px] text-muted-foreground">SSH Host</Label>
                    <Input
                      id="sshHost"
                      value={formData.sshHost}
                      onChange={(e) => setFormData({ ...formData, sshHost: e.target.value })}
                      placeholder="bastion.example.com"
                      className="bg-input/80 border-border/50 text-foreground font-mono text-sm rounded-lg h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="sshPort" className="font-mono text-[11px] text-muted-foreground">SSH Port</Label>
                    <Input
                      id="sshPort"
                      value={formData.sshPort}
                      onChange={(e) => setFormData({ ...formData, sshPort: e.target.value })}
                      placeholder="22"
                      className="bg-input/80 border-border/50 text-foreground font-mono text-sm rounded-lg h-8"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sshUser" className="font-mono text-[11px] text-muted-foreground">SSH User</Label>
                  <Input
                    id="sshUser"
                    value={formData.sshUser}
                    onChange={(e) => setFormData({ ...formData, sshUser: e.target.value })}
                    placeholder="ubuntu"
                    className="bg-input/80 border-border/50 text-foreground font-mono text-sm rounded-lg h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sshPassword" className="font-mono text-[11px] text-muted-foreground">SSH Password</Label>
                  <Input
                    id="sshPassword"
                    type="password"
                    value={formData.sshPassword}
                    onChange={(e) => setFormData({ ...formData, sshPassword: e.target.value })}
                    placeholder="••••••••"
                    className="bg-input/80 border-border/50 text-foreground font-mono text-sm rounded-lg h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sshKeyPath" className="font-mono text-[11px] text-muted-foreground">Private Key Path</Label>
                  <Input
                    id="sshKeyPath"
                    value={formData.sshKeyPath}
                    onChange={(e) => setFormData({ ...formData, sshKeyPath: e.target.value })}
                    placeholder="~/.ssh/id_rsa"
                    className="bg-input/80 border-border/50 text-foreground font-mono text-sm rounded-lg h-8"
                  />
                </div>
              </div>
            )}
          </div>

          {testResult && (
            <div
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs font-mono ${
                testResult.ok
                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-500"
                  : "border-destructive/30 bg-destructive/5 text-destructive"
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              )}
              <span className="break-all">{testResult.message}</span>
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleTestConnection()}
              disabled={testing || !formData.host || !formData.database}
              className="font-mono text-xs"
            >
              {testing && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
              Test Connection
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="font-mono text-xs">
                Cancel
              </Button>
              <Button type="submit" variant="gradient" className="font-mono text-xs">
                {isEditing ? "Save Changes" : "Connect"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
