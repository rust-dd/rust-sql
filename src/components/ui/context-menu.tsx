import React, { useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

export interface ContextMenuSeparator {
  separator: true;
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator;

function isSeparator(entry: ContextMenuEntry): entry is ContextMenuSeparator {
  return "separator" in entry;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuEntry[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - items.length * 32 - 16);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[160px] rounded-md border border-border bg-popover py-1 shadow-md animate-in fade-in-0 zoom-in-95"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {items.map((entry, i) => {
        if (isSeparator(entry)) {
          return <div key={i} className="my-1 h-px bg-border" />;
        }
        return (
          <button
            key={i}
            onClick={() => {
              entry.onClick();
              onClose();
            }}
            disabled={entry.disabled}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-mono transition-colors",
              entry.disabled
                ? "text-muted-foreground/50 cursor-not-allowed"
                : entry.destructive
                  ? "text-destructive hover:bg-destructive/10"
                  : "text-popover-foreground hover:bg-accent",
            )}
          >
            {entry.icon && <span className="w-4 h-4 flex items-center justify-center shrink-0">{entry.icon}</span>}
            <span>{entry.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Hook to manage context menu state */
export function useContextMenu() {
  const [menu, setMenu] = React.useState<{ x: number; y: number; items: ContextMenuEntry[] } | null>(null);

  const showMenu = useCallback((e: React.MouseEvent, items: ContextMenuEntry[]) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, items });
  }, []);

  const closeMenu = useCallback(() => setMenu(null), []);

  return { menu, showMenu, closeMenu };
}
