import { Database, Play, Save, Settings } from "lucide-react"
import { Button } from "./ui/button"

export function TopBar() {
  return (
    <div className="flex h-12 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <span className="font-mono text-sm font-semibold">PostgresGUI</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <div className="h-2 w-2 rounded-full bg-success" />
          <span className="font-mono">production-db</span>
          <span className="text-muted-foreground/50">•</span>
          <span>localhost:5432</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-8 gap-2">
          <Save className="h-4 w-4" />
          <span className="text-xs">Save</span>
        </Button>
        <Button variant="default" size="sm" className="h-8 gap-2 bg-primary text-primary-foreground">
          <Play className="h-4 w-4" />
          <span className="text-xs">Execute</span>
        </Button>
        <div className="h-4 w-px bg-border" />
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
