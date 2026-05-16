import { Save } from "lucide-react";
import type { Page } from "./types";

export function SaveQueryPage({
  queryName,
  setQueryName,
  setPage,
  handleSaveQuery,
}: {
  queryName: string;
  setQueryName: (v: string) => void;
  setPage: (p: Page) => void;
  handleSaveQuery: () => Promise<void>;
}) {
  return (
    <>
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Save className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          placeholder="Query name..."
          value={queryName}
          onChange={(e) => setQueryName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSaveQuery();
            else if (e.key === "Escape") {
              e.stopPropagation();
              setPage("root");
              setQueryName("");
            }
          }}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none font-mono"
        />
      </div>
      <div className="px-4 py-3 text-xs text-muted-foreground">
        Press Enter to save the current query
      </div>
    </>
  );
}
