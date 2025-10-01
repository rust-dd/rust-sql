"use client"

import { useState } from "react"
import { ServerSidebar } from "./server-sidebar"
import { EditorTabs } from "./editor-tabs"
import { QueryResults } from "./query-results"
import { TopBar } from "./top-bar"
import { Button } from "./ui/button"
import { PanelLeftClose, PanelLeft } from "lucide-react"
import { ResizeHandle } from "./resize-handle"
import { ConnectionModal, type ConnectionConfig } from "./connection-modal"

export function PostgresGUI() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(280)
  const [editorHeight, setEditorHeight] = useState(60) // percentage
  const [activeTab, setActiveTab] = useState("query-1")
  const [tabs, setTabs] = useState([{ id: "query-1", title: "Query 1", content: "SELECT * FROM users;" }])
  const [connectionModalOpen, setConnectionModalOpen] = useState(false)
  const [connections, setConnections] = useState<ConnectionConfig[]>([])

  const addNewTab = () => {
    const newId = `query-${tabs.length + 1}`
    setTabs([...tabs, { id: newId, title: `Query ${tabs.length + 1}`, content: "" }])
    setActiveTab(newId)
  }

  const closeTab = (id: string) => {
    const newTabs = tabs.filter((tab) => tab.id !== id)
    setTabs(newTabs)
    if (activeTab === id && newTabs.length > 0) {
      setActiveTab(newTabs[0].id)
    }
  }

  const updateTabContent = (id: string, content: string) => {
    setTabs(tabs.map((tab) => (tab.id === id ? { ...tab, content } : tab)))
  }

  const handleSidebarResize = (delta: number) => {
    setSidebarWidth((prev) => Math.max(200, Math.min(600, prev + delta)))
  }

  const handleEditorResize = (delta: number) => {
    const containerHeight = window.innerHeight - 48 // subtract top bar height
    const deltaPercent = (delta / containerHeight) * 100
    setEditorHeight((prev) => Math.max(20, Math.min(80, prev + deltaPercent)))
  }

  const handleSaveConnection = (connection: ConnectionConfig) => {
    setConnections([...connections, connection])
    console.log("[v0] New connection added:", connection)
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-2 top-16 z-10 h-8 w-8"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
        </Button>

        {/* Sidebar */}
        {sidebarOpen && (
          <>
            <div style={{ width: `${sidebarWidth}px` }} className="flex-shrink-0">
              <ServerSidebar onAddConnection={() => setConnectionModalOpen(true)} />
            </div>
            <ResizeHandle direction="horizontal" onResize={handleSidebarResize} />
          </>
        )}

        {/* Main Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div style={{ height: `${editorHeight}%` }} className="flex flex-col overflow-hidden">
            <EditorTabs
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onTabClose={closeTab}
              onNewTab={addNewTab}
              onContentChange={updateTabContent}
            />
          </div>
          <ResizeHandle direction="vertical" onResize={handleEditorResize} />
          <div className="flex-1 min-h-0">
            <QueryResults />
          </div>
        </div>
      </div>

      {/* Connection Modal */}
      <ConnectionModal open={connectionModalOpen} onOpenChange={setConnectionModalOpen} onSave={handleSaveConnection} />
    </div>
  )
}
