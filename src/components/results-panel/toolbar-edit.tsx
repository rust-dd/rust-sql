import { Loader2, Save, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import type { EditState } from "./types";

interface ToolbarEditProps {
  editState: EditState | null;
  editError: string | null;
  isCommitting: boolean;
  pendingDeleteCount: number;
  onCommit: () => void;
  onDeleteRows: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onDiscard: () => void;
}

export function ToolbarEdit({
  editState,
  editError,
  isCommitting,
  pendingDeleteCount,
  onCommit,
  onDeleteRows,
  onConfirmDelete,
  onCancelDelete,
  onDiscard,
}: ToolbarEditProps) {
  return (
    <>
      {editError && (
        <span className="text-xs text-destructive max-w-[200px] truncate" title={editError}>
          {editError}
        </span>
      )}
      <button
        type="button"
        onClick={onCommit}
        disabled={(editState?.cellEdits.size ?? 0) === 0 || isCommitting}
        className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono bg-success text-success-foreground hover:bg-success/90 transition-colors disabled:opacity-50"
      >
        {isCommitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
        Commit
      </button>
      <button
        type="button"
        onClick={onDeleteRows}
        disabled={(editState?.deletedRows.size ?? 0) === 0 || isCommitting}
        className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono border border-destructive/50 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
      >
        <Trash2 className="h-3 w-3" />
        Delete ({editState?.deletedRows.size ?? 0})
      </button>
      <Dialog
        open={pendingDeleteCount > 0}
        onOpenChange={(open) => {
          if (!open) onCancelDelete();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete rows</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete {pendingDeleteCount} row
              {pendingDeleteCount !== 1 ? "s" : ""}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={onCancelDelete}
              className="px-3 py-1.5 rounded-lg text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirmDelete}
              className="px-3 py-1.5 rounded-lg text-xs font-mono bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
            >
              Yes, delete {pendingDeleteCount} row{pendingDeleteCount !== 1 ? "s" : ""}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <button
        type="button"
        onClick={onDiscard}
        disabled={isCommitting}
        className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
      >
        <X className="h-3 w-3" />
        Discard
      </button>
    </>
  );
}
