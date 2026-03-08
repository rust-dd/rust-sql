import React, { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  shortcut?: string;
}

export interface ContextMenuSeparator {
  separator: true;
}

export interface ContextMenuHeader {
  header: string;
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator | ContextMenuHeader;

function isSeparator(entry: ContextMenuEntry): entry is ContextMenuSeparator {
  return "separator" in entry;
}

function isHeader(entry: ContextMenuEntry): entry is ContextMenuHeader {
  return "header" in entry;
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

  // Calculate menu height for viewport adjustment
  const itemCount = items.filter((e) => !isSeparator(e) && !isHeader(e)).length;
  const separatorCount = items.filter(isSeparator).length;
  const headerCount = items.filter(isHeader).length;
  const estimatedHeight = itemCount * 32 + separatorCount * 9 + headerCount * 28 + 12;

  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - estimatedHeight);

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[9999] min-w-[200px] rounded-xl border border-border/80 bg-popover/95 backdrop-blur-xl py-1.5 shadow-xl shadow-black/20 animate-in fade-in-0 zoom-in-95 duration-100"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {items.map((entry, i) => {
        if (isSeparator(entry)) {
          return <div key={i} className="my-1.5 mx-2 h-px bg-border/60" />;
        }
        if (isHeader(entry)) {
          return (
            <div key={i} className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
              {entry.header}
            </div>
          );
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
              "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[12px] font-mono transition-colors rounded-md mx-1 first:mt-0",
              "focus:outline-none",
              entry.disabled
                ? "text-muted-foreground/40 cursor-not-allowed"
                : entry.destructive
                  ? "text-destructive hover:bg-destructive/10"
                  : "text-popover-foreground hover:bg-accent/80",
            )}
            style={{ width: "calc(100% - 8px)" }}
          >
            {entry.icon && (
              <span className="w-4 h-4 flex items-center justify-center shrink-0 opacity-70">
                {entry.icon}
              </span>
            )}
            <span className="flex-1">{entry.label}</span>
            {entry.shortcut && (
              <span className="text-[10px] text-muted-foreground/50 font-mono ml-2 shrink-0">
                {entry.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>,
    document.body,
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
