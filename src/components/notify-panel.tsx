import { useState, useEffect, useRef, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { DriverFactory } from "@/lib/database-driver";
import { useProjectStore } from "@/stores/project-store";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Bell, BellOff, Send, Trash2, Radio } from "lucide-react";
import { cn } from "@/lib/utils";


interface Notification {
  channel: string;
  payload: string;
  timestamp: string;
}

interface NotifyPanelProps {
  projectId: string;
}

export function NotifyPanel({ projectId }: NotifyPanelProps) {
  const [channels, setChannels] = useState<string[]>([]);
  const [newChannel, setNewChannel] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [sendChannel, setSendChannel] = useState("");
  const [sendPayload, setSendPayload] = useState("");
  const [knownChannels, setKnownChannels] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const projects = useProjectStore((s) => s.projects);
  const channelsRef = useRef<string[]>([]);
  channelsRef.current = channels;

  const driver = projects[projectId] ? DriverFactory.getDriver(projects[projectId].driver) : null;

  // Discover available channels from trigger functions
  useEffect(() => {
    if (!driver) return;
    driver.discoverChannels?.(projectId).then(setKnownChannels).catch(() => {});
  }, [driver, projectId]);

  useEffect(() => {
    const eventName = `pg-notify-${projectId}`;
    let unlisten: (() => void) | null = null;

    listen<{ channel: string; payload: string }>(eventName, (event) => {
      setNotifications((prev) => [
        ...prev,
        {
          channel: event.payload.channel,
          payload: event.payload.payload,
          timestamp: new Date().toISOString(),
        },
      ]);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [projectId]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [notifications]);

  const subscribe = useCallback(async () => {
    const ch = newChannel.trim();
    if (!ch || !driver || channels.includes(ch)) return;
    await driver.listenStart?.(projectId, ch);
    setChannels((prev) => [...prev, ch]);
    setNewChannel("");
  }, [newChannel, driver, projectId, channels]);

  const unsubscribe = useCallback(
    async (ch: string) => {
      await driver?.listenStop?.(projectId, ch);
      setChannels((prev) => prev.filter((c) => c !== ch));
    },
    [driver, projectId],
  );

  const sendNotify = useCallback(async () => {
    const ch = sendChannel.trim();
    if (!ch || !driver) return;
    await driver.notifySend?.(projectId, ch, sendPayload);
    setSendPayload("");
  }, [sendChannel, sendPayload, driver, projectId]);

  useEffect(() => {
    return () => {
      channelsRef.current.forEach((ch) => {
        driver?.listenStop?.(projectId, ch).catch(() => {});
      });
    };
  }, []); // eslint-disable-line

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
        <Bell className="h-3.5 w-3.5 text-primary" />
        <Input
          value={newChannel}
          onChange={(e) => setNewChannel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && subscribe()}
          placeholder="Channel name..."
          className="h-7 text-xs font-mono flex-1 bg-input/50"
          list="known-channels"
        />
        {knownChannels.length > 0 && (
          <datalist id="known-channels">
            {knownChannels.filter((c) => !channels.includes(c)).map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        )}
        <Button variant="outline" size="sm" onClick={subscribe} className="h-7 text-xs font-mono gap-1">
          <Bell className="h-3 w-3" /> Subscribe
        </Button>
      </div>

      {/* Discovered channels */}
      {knownChannels.length > 0 && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border/20 flex-wrap">
          <Radio className="h-3 w-3 text-muted-foreground/50 mr-0.5" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider mr-1">Available:</span>
          {knownChannels.map((ch) => {
            const isActive = channels.includes(ch);
            return (
              <button
                key={ch}
                onClick={async () => {
                  if (isActive) return;
                  await driver?.listenStart?.(projectId, ch);
                  setChannels((prev) => [...prev, ch]);
                }}
                disabled={isActive}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary/50 cursor-default"
                    : "bg-muted/30 text-muted-foreground hover:bg-primary/10 hover:text-primary",
                )}
              >
                {ch}
                {isActive && <Bell className="h-2.5 w-2.5" />}
              </button>
            );
          })}
        </div>
      )}

      {channels.length > 0 && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border/20 flex-wrap">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider mr-1">Listening:</span>
          {channels.map((ch) => (
            <button
              key={ch}
              onClick={() => unsubscribe(ch)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-mono hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="Click to unsubscribe"
            >
              {ch} <BellOff className="h-2.5 w-2.5" />
            </button>
          ))}
        </div>
      )}

      <div ref={listRef} className="flex-1 overflow-auto p-3 space-y-1">
        {notifications.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground/40 text-sm font-mono">
            {channels.length === 0 ? "Subscribe to a channel to start" : "Waiting for notifications..."}
          </div>
        ) : (
          notifications.map((n, i) => (
            <div key={i} className="flex items-start gap-2 text-xs font-mono px-2 py-1.5 rounded-lg hover:bg-muted/30">
              <span className="text-muted-foreground/50 shrink-0">{new Date(n.timestamp).toLocaleTimeString()}</span>
              <span className="text-primary font-medium shrink-0">{n.channel}</span>
              <span className="text-foreground break-all">
                {n.payload || <span className="text-muted-foreground/40 italic">empty</span>}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-t border-border/30">
        <Input
          value={sendChannel}
          onChange={(e) => setSendChannel(e.target.value)}
          placeholder="Channel"
          className="h-7 text-xs font-mono w-[140px] bg-input/50"
        />
        <Input
          value={sendPayload}
          onChange={(e) => setSendPayload(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendNotify()}
          placeholder="Payload..."
          className="h-7 text-xs font-mono flex-1 bg-input/50"
        />
        <Button variant="outline" size="sm" onClick={sendNotify} className="h-7 text-xs font-mono gap-1">
          <Send className="h-3 w-3" /> Send
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setNotifications([])} className="h-7 text-xs" title="Clear">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
