"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"

interface ConnectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (connection: ConnectionConfig) => void
}

export interface ConnectionConfig {
  id: string
  name: string
  host: string
  port: string
  database: string
  username: string
  password: string
  ssl: boolean
}

export function ConnectionModal({ open, onOpenChange, onSave }: ConnectionModalProps) {
  const [formData, setFormData] = useState<Omit<ConnectionConfig, "id">>({
    name: "",
    host: "localhost",
    port: "5432",
    database: "",
    username: "",
    password: "",
    ssl: false,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newConnection: ConnectionConfig = {
      ...formData,
      id: `conn-${Date.now()}`,
    }
    onSave(newConnection)
    onOpenChange(false)
    // Reset form
    setFormData({
      name: "",
      host: "localhost",
      port: "5432",
      database: "",
      username: "",
      password: "",
      ssl: false,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-mono text-foreground">New Connection</DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Add a new PostgreSQL database connection
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
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
              className="bg-input border-border text-foreground font-mono text-sm"
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
                className="bg-input border-border text-foreground font-mono text-sm"
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
                className="bg-input border-border text-foreground font-mono text-sm"
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
              className="bg-input border-border text-foreground font-mono text-sm"
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
              className="bg-input border-border text-foreground font-mono text-sm"
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
              className="bg-input border-border text-foreground font-mono text-sm"
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
            <Button type="submit" className="font-mono text-xs bg-primary text-primary-foreground">
              Connect
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
