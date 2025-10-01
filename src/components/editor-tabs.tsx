
import { X, Plus } from "lucide-react"
import { Button } from "./ui/button"
import { cn } from "@/lib/utils"
import { SQLEditor } from "./sql-editor"

interface Tab {
  id: string
  title: string
  content: string
}

interface EditorTabsProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (id: string) => void
  onTabClose: (id: string) => void
  onNewTab: () => void
  onContentChange: (id: string, content: string) => void
}

export function EditorTabs({ tabs, activeTab, onTabChange, onTabClose, onNewTab, onContentChange }: EditorTabsProps) {
  const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content || ""

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Tab Bar */}
      <div className="flex items-center border-b border-border bg-card">
        <div className="flex flex-1 items-center overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                "group flex items-center gap-2 border-r border-border px-4 py-2.5 transition-colors",
                activeTab === tab.id
                  ? "bg-editor-bg text-foreground"
                  : "bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <button onClick={() => onTabChange(tab.id)} className="font-mono text-xs">
                {tab.title}
              </button>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onTabClose(tab.id)
                  }}
                  className="opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
        <Button variant="ghost" size="icon" onClick={onNewTab} className="h-9 w-9 shrink-0">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor */}
      <SQLEditor value={activeTabContent} onChange={(content) => onContentChange(activeTab, content)} />
    </div>
  )
}
