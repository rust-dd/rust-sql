import { useState } from "react"
import { ChevronRight, ChevronDown, Database, Server, Table, Columns, Plus } from "lucide-react"
import { Button } from "./ui/button"
import { cn } from "@/lib/utils"

interface TreeNode {
  id: string
  name: string
  type: "server" | "database" | "schema" | "table" | "column"
  children?: TreeNode[]
  icon?: string
}

const mockServers: TreeNode[] = [
  {
    id: "server-1",
    name: "production-db",
    type: "server",
    children: [
      {
        id: "db-1",
        name: "main_database",
        type: "database",
        children: [
          {
            id: "schema-1",
            name: "public",
            type: "schema",
            children: [
              {
                id: "table-1",
                name: "users",
                type: "table",
                children: [
                  { id: "col-1", name: "id", type: "column", icon: "PK" },
                  { id: "col-2", name: "email", type: "column" },
                  { id: "col-3", name: "created_at", type: "column" },
                ],
              },
              {
                id: "table-2",
                name: "posts",
                type: "table",
                children: [
                  { id: "col-4", name: "id", type: "column", icon: "PK" },
                  { id: "col-5", name: "user_id", type: "column", icon: "FK" },
                  { id: "col-6", name: "title", type: "column" },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "server-2",
    name: "staging-db",
    type: "server",
    children: [
      {
        id: "db-2",
        name: "staging_database",
        type: "database",
        children: [],
      },
    ],
  },
]

function TreeItem({ node, level = 0 }: { node: TreeNode; level?: number }) {
  const [expanded, setExpanded] = useState(level < 2)
  const hasChildren = node.children && node.children.length > 0

  const getIcon = () => {
    switch (node.type) {
      case "server":
        return <Server className="h-4 w-4" />
      case "database":
        return <Database className="h-4 w-4" />
      case "table":
        return <Table className="h-4 w-4" />
      case "column":
        return <Columns className="h-4 w-4" />
      default:
        return <Database className="h-4 w-4" />
    }
  }

  return (
    <div>
      <button
        onClick={() => hasChildren && setExpanded(!expanded)}
        className={cn(
          "flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-sidebar-accent",
          "transition-colors rounded-sm",
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )
        ) : (
          <span className="w-3" />
        )}
        <span className={cn("text-muted-foreground", node.type === "server" && "text-primary")}>{getIcon()}</span>
        <span className={cn("flex-1 font-mono text-xs", node.type === "server" && "font-semibold")}>{node.name}</span>
        {node.icon && (
          <span className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">{node.icon}</span>
        )}
      </button>
      {expanded && hasChildren && (
        <div>
          {node.children?.map((child) => (
            <TreeItem key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export function ServerSidebar({ onAddConnection }: { onAddConnection: () => void }) {
  return (
    <div className="flex h-full flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-12 items-center justify-between border-b border-sidebar-border px-3">
        <span className="font-mono text-xs font-semibold text-sidebar-foreground">CONNECTIONS</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onAddConnection}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {mockServers.map((server) => (
          <TreeItem key={server.id} node={server} />
        ))}
      </div>
    </div>
  )
}
