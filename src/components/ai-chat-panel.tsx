import { useState, useRef, useEffect, useCallback } from "react";
import {
  Settings,
  Send,
  Copy,
  Play,
  Square,
  Sparkles,
  X,
  Database,
  FileCode,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useSettingsStore, getModelsForProvider } from "@/stores/settings-store";
import { useProjectStore } from "@/stores/project-store";
import { useTabStore } from "@/stores/tab-store";
import { DriverFactory } from "@/lib/database-driver";
import { aiChat, type ChatMessage } from "@/lib/ai-service";
import { classifySQL } from "@/lib/sql-classify";
import { buildSchemaContext } from "@/lib/schema-context";
import { useUIStore } from "@/stores/ui-store";
import { AISettingsDialog } from "@/components/ai-settings-dialog";
import { ProjectConnectionStatus as PCS } from "@/types";

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  sqlBlocks: SQLBlock[];
}

interface SQLBlock {
  sql: string;
  type: "select" | "write";
}

function extractSQLBlocks(text: string): SQLBlock[] {
  const blocks: SQLBlock[] = [];
  const regex = /```sql\s*\n([\s\S]*?)```/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const sql = match[1].trim();
    if (sql) {
      blocks.push({ sql, type: classifySQL(sql) });
    }
  }
  return blocks;
}

/** Parse markdown-ish content into segments for rendering */
function parseContent(content: string) {
  const segments: Array<
    | { type: "text"; value: string }
    | { type: "sql"; value: string }
    | { type: "code"; value: string; lang?: string }
    | { type: "inline-code"; value: string }
  > = [];

  // Match fenced code blocks (sql and other)
  const codeBlockRegex = /```(\w*)\s*\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }
    const lang = match[1].toLowerCase();
    const code = match[2].trim();
    if (lang === "sql") {
      segments.push({ type: "sql", value: code });
    } else {
      segments.push({ type: "code", value: code, lang: lang || undefined });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.slice(lastIndex) });
  }

  return segments;
}

/** Render a text segment with inline formatting (bold, inline code, etc.) */
function renderTextSegment(text: string, key: number) {
  const parts: React.ReactNode[] = [];
  // Process inline code, bold, and line breaks
  const inlineRegex = /(`[^`]+`|\*\*[^*]+\*\*|\n)/g;
  let lastIdx = 0;
  let m;
  let subKey = 0;

  while ((m = inlineRegex.exec(text)) !== null) {
    if (m.index > lastIdx) {
      parts.push(<span key={`${key}-${subKey++}`}>{text.slice(lastIdx, m.index)}</span>);
    }
    const token = m[0];
    if (token === "\n") {
      parts.push(<br key={`${key}-${subKey++}`} />);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={`${key}-${subKey++}`}
          className="px-1.5 py-0.5 rounded bg-muted/60 text-[12px] font-mono text-foreground/90"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={`${key}-${subKey++}`} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>,
      );
    }
    lastIdx = m.index + token.length;
  }

  if (lastIdx < text.length) {
    parts.push(<span key={`${key}-${subKey++}`}>{text.slice(lastIdx)}</span>);
  }

  return <span key={key}>{parts}</span>;
}

function SQLCodeBlock({
  sql,
  type,
  onCopy,
  onRun,
}: {
  sql: string;
  type: "select" | "write";
  onCopy: () => void;
  onRun: () => void;
}) {
  return (
    <div className="my-2.5 rounded-lg border border-border/50 overflow-hidden bg-[#0d1117] dark:bg-[#0d1117]">
      {/* SQL header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#161b22] border-b border-border/30">
        <span className="text-[10px] font-mono text-muted-foreground/70 uppercase tracking-wider">
          sql
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onCopy}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            title="Copy SQL"
          >
            <Copy className="h-3 w-3" />
            Copy
          </button>
          {type === "select" ? (
            <button
              onClick={onRun}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
              title="Execute SELECT"
            >
              <Play className="h-3 w-3" />
              Run
            </button>
          ) : (
            <button
              onClick={onRun}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
              title="Open in editor"
            >
              <FileCode className="h-3 w-3" />
              Edit
            </button>
          )}
        </div>
      </div>
      {/* SQL code */}
      <pre className="px-3 py-3 overflow-x-auto">
        <code className="text-[12px] leading-relaxed font-mono text-emerald-400 whitespace-pre-wrap">
          {sql}
        </code>
      </pre>
    </div>
  );
}

export function AIChatPanel() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const aiProvider = useSettingsStore((s) => s.aiProvider);
  const aiModel = useSettingsStore((s) => s.aiModel);
  const claudeApiKey = useSettingsStore((s) => s.claudeApiKey);
  const openaiApiKey = useSettingsStore((s) => s.openaiApiKey);
  const loaded = useSettingsStore((s) => s.loaded);

  const projects = useProjectStore((s) => s.projects);
  const connectionStatus = useProjectStore((s) => s.status);
  const connectProject = useProjectStore((s) => s.connect);

  useEffect(() => {
    if (!loaded) void useSettingsStore.getState().load();
  }, [loaded]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const apiKey = aiProvider === "claude" ? claudeApiKey : openaiApiKey;
  const models = getModelsForProvider(aiProvider, useSettingsStore.getState());
  const modelLabel = models.find((m) => m.id === aiModel)?.label ?? aiModel;

  const connectedProjectId =
    selectedProjectId && connectionStatus[selectedProjectId] === PCS.Connected
      ? selectedProjectId
      : undefined;

  // Auto-load full schema metadata when a connected project is selected
  useEffect(() => {
    if (!connectedProjectId) return;

    const loadAll = async () => {
      const store = useProjectStore.getState();
      let projectSchemas = store.schemas[connectedProjectId] ?? [];

      if (projectSchemas.length === 0) {
        await store.loadSchemas(connectedProjectId);
        projectSchemas = useProjectStore.getState().schemas[connectedProjectId] ?? [];
      }

      for (const schema of projectSchemas) {
        const tableKey = `${connectedProjectId}::${schema}`;
        if (!useProjectStore.getState().tables[tableKey]) {
          await store.loadTables(connectedProjectId, schema);
        }
        const tables = useProjectStore.getState().tables[tableKey] ?? [];

        // Batch load column details for all tables that haven't been loaded
        const toLoad = tables.filter((t) => {
          const colKey = `${connectedProjectId}::${schema}::${t.name}`;
          return !useProjectStore.getState().columnDetails[colKey];
        });
        if (toLoad.length > 0) {
          await Promise.allSettled(
            toLoad.map((t) => store.loadColumnDetails(connectedProjectId, schema, t.name)),
          );
        }
      }
    };
    void loadAll();
  }, [connectedProjectId]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    if (!apiKey) {
      toast.error("No API key configured", {
        description: "Open AI Settings to add your API key",
      });
      setSettingsOpen(true);
      return;
    }

    const userMsg: DisplayMessage = { role: "user", content: text, sqlBlocks: [] };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const chatHistory: ChatMessage[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: text },
    ];

    const schemaCtx = connectedProjectId ? buildSchemaContext(connectedProjectId) : "";
    const dbInfo = connectedProjectId
      ? (() => {
          const d = projects[connectedProjectId];
          return d ? `Connected to: ${d.database} (${d.driver}) on ${d.host}:${d.port}` : "";
        })()
      : "";

    const systemPrompt = [
      `You are an expert PostgreSQL assistant embedded in a database GUI called RSQL.
You have direct access to the database schema provided below. Use it to write precise, correct SQL.

Rules:
- NEVER ask the user for table names, column names, or types — you already have the full schema.
- ALWAYS use the exact table and column names from the schema. Respect schema prefixes (e.g. public.users).
- When providing SQL, wrap it in \`\`\`sql code blocks.
- Be concise. Give the SQL directly, with brief explanation only when needed.
- For SELECT queries: write them ready to run.
- For write operations (INSERT, UPDATE, DELETE, ALTER, DROP, CREATE): provide the SQL but note it will be opened in editor for review.
- If the user's request is ambiguous, make a reasonable assumption based on the schema and note your assumption briefly.
- Use modern PostgreSQL syntax (CTEs, window functions, JSONB operators, etc.) when appropriate.
- When the user asks to "show", "list", "find", or "get" something, always respond with a SELECT query.`,
      dbInfo,
      schemaCtx,
    ]
      .filter(Boolean)
      .join("\n\n");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await aiChat({
        provider: aiProvider,
        model: aiModel,
        apiKey,
        messages: chatHistory,
        systemPrompt,
        signal: controller.signal,
      });

      const sqlBlocks = extractSQLBlocks(response);
      const assistantMsg: DisplayMessage = {
        role: "assistant",
        content: response,
        sqlBlocks,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("AI request failed", { description: msg });
      const errorMsg: DisplayMessage = {
        role: "assistant",
        content: `Error: ${msg}`,
        sqlBlocks: [],
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [input, loading, apiKey, messages, connectedProjectId, projects, aiProvider, aiModel]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
  }, []);

  const handleCopySQL = useCallback((sql: string) => {
    void navigator.clipboard.writeText(sql);
    toast.success("SQL copied to clipboard");
  }, []);

  const handleRunSQL = useCallback(
    async (sql: string) => {
      if (!connectedProjectId) {
        toast.error("No active database connection");
        return;
      }

      const type = classifySQL(sql);
      if (type === "write") {
        useTabStore.getState().openTab(connectedProjectId, sql);
        toast.info("Query opened in new tab for review");
        return;
      }

      const d = projects[connectedProjectId];
      if (!d) return;

      try {
        const driver = DriverFactory.getDriver(d.driver);
        const [cols, rows, time] = await driver.runQuery(connectedProjectId, sql);
        const store = useTabStore.getState();
        store.openTab(connectedProjectId, sql);
        const newIdx = store.tabs.length - 1;
        store.updateResult(newIdx, { columns: cols, rows, time });
        toast.success(`${rows.length} rows in ${time.toFixed(1)}ms`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error("Query failed", { description: msg });
      }
    },
    [connectedProjectId, projects],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  const handleClearChat = useCallback(() => {
    setMessages([]);
  }, []);

  // Build rendered segments for assistant messages
  const renderAssistantContent = (msg: DisplayMessage) => {
    const segments = parseContent(msg.content);
    let sqlIdx = 0;

    return segments.map((seg, i) => {
      if (seg.type === "text") {
        return renderTextSegment(seg.value, i);
      }
      if (seg.type === "sql") {
        const block = msg.sqlBlocks[sqlIdx];
        sqlIdx++;
        return (
          <SQLCodeBlock
            key={i}
            sql={seg.value}
            type={block?.type ?? "select"}
            onCopy={() => handleCopySQL(seg.value)}
            onRun={() => void handleRunSQL(seg.value)}
          />
        );
      }
      if (seg.type === "code") {
        return (
          <pre
            key={i}
            className="my-2.5 px-3 py-3 rounded-lg border border-border/50 bg-[#0d1117] overflow-x-auto"
          >
            <code className="text-[12px] leading-relaxed font-mono text-foreground/80 whitespace-pre-wrap">
              {seg.value}
            </code>
          </pre>
        );
      }
      return null;
    });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-10 border-b border-border/40 bg-card/50">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-[11px] font-mono text-muted-foreground truncate">
            {modelLabel}
          </span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={handleClearChat}
              title="Clear chat"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={() => setSettingsOpen(true)}
            title="AI Settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={() => useUIStore.getState().toggleAIPanel()}
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* DB selector */}
      <div className="flex items-center gap-2 px-3 h-8 border-b border-border/30 bg-card/30">
        <Database className="h-3 w-3 text-muted-foreground shrink-0" />
        <select
          value={selectedProjectId ?? ""}
          onChange={(e) => {
            const id = e.target.value || undefined;
            setSelectedProjectId(id);
            if (id && connectionStatus[id] !== PCS.Connected) {
              void connectProject(id);
            }
          }}
          className="flex-1 min-w-0 h-6 rounded border-none bg-transparent text-xs font-mono text-foreground focus-visible:outline-none truncate"
        >
          <option value="">No database</option>
          {Object.entries(projects).map(([id, d]) => (
            <option key={id} value={id}>
              {id} ({d.database})
              {connectionStatus[id] === PCS.Connected ? "" : " - disconnected"}
            </option>
          ))}
        </select>
        {connectedProjectId && (
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 space-y-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary/50" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-foreground/70">SQL Assistant</p>
              <p className="text-xs text-muted-foreground/50 leading-relaxed max-w-[240px]">
                Write queries, explain SQL, or explore your schema.
                {!connectedProjectId && " Connect a database for schema context."}
              </p>
            </div>
          </div>
        )}

        <div className="px-4 py-3 space-y-5">
          {messages.map((msg, i) =>
            msg.role === "user" ? (
              /* User message */
              <div key={i} className="flex justify-end">
                <div className="max-w-[88%] rounded-2xl rounded-br-md px-4 py-2.5 bg-primary text-primary-foreground">
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ) : (
              /* Assistant message */
              <div key={i} className="space-y-0">
                <div className="max-w-full text-[13px] leading-[1.7] text-foreground/90">
                  {renderAssistantContent(msg)}
                </div>
              </div>
            ),
          )}

          {loading && (
            <div className="flex items-center gap-2 py-2">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
              </div>
              <span className="text-xs text-muted-foreground/50 font-mono">Thinking...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border/40 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              connectedProjectId
                ? "Ask about your database..."
                : "Ask a SQL question..."
            }
            rows={1}
            className="flex-1 resize-none rounded-xl border border-border/50 bg-input px-3.5 py-2.5 text-[13px] placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 max-h-32 overflow-y-auto"
            style={{ minHeight: "40px" }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "40px";
              target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
            }}
          />
          {loading ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl"
              onClick={handleStop}
              title="Stop"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="default"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl"
              onClick={() => void handleSend()}
              disabled={!input.trim()}
              title="Send (Enter)"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <AISettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
