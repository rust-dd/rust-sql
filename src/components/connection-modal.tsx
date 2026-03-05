import type React from "react"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { DriverFactory, DRIVER_CONFIGS } from "@/lib/database-driver"
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
}

export function ConnectionModal({ open, onOpenChange, onSave, editData }: ConnectionModalProps) {
  const [formData, setFormData] = useState<Omit<ConnectionConfig, "id">>(defaultForm)

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
      })
    } else if (open && !editData) {
      setFormData(defaultForm)
    }
  }, [open, editData])

  const isEditing = !!editData

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const connection: ConnectionConfig = {
      ...formData,
      id: editData ? editData.name : `conn-${Date.now()}`,
    }
    onSave(connection)
    onOpenChange(false)
  }

  const handleDriverChange = (driver: DriverType) => {
    const config = DRIVER_CONFIGS[driver]
    setFormData({
      ...formData,
      driver,
      port: config.defaultPort,
    })
  }

  const supportedDrivers = DriverFactory.getSupportedDrivers()

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
          <div className="space-y-2">
            <Label htmlFor="driver" className="font-mono text-xs text-foreground">
              Database Type
            </Label>
            <select
              id="driver"
              value={formData.driver}
              onChange={(e) => handleDriverChange(e.target.value as DriverType)}
              className="w-full bg-input/80 border border-border/50 text-foreground font-mono text-sm rounded-lg px-3 py-2"
              disabled={isEditing}
            >
              {supportedDrivers.map((driverType) => (
                <option key={driverType} value={driverType}>
                  {DRIVER_CONFIGS[driverType].name}
                </option>
              ))}
            </select>
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

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="font-mono text-xs">
              Cancel
            </Button>
            <Button type="submit" variant="gradient" className="font-mono text-xs">
              {isEditing ? "Save Changes" : "Connect"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
