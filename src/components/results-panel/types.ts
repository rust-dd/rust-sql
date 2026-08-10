import type { CellValue } from "@/lib/wire";

export type PanelView = "grid" | "record" | "history" | "explain" | "diff" | "map";

export interface ToolbarProps {
  panelView: PanelView;
  setPanelView: (v: PanelView) => void;
  result: { rows: CellValue[][]; time: number; capped?: boolean } | null;
  columns: string[];
  filteredRows: CellValue[][];
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  filteredCount: number;
  setViewMode: (mode: "grid" | "record") => void;
  viewMode: "grid" | "record";
  hasExplain: boolean;
  isExecuting: boolean;
  isEditing: boolean;
  editableTable: boolean;
  isCommitting: boolean;
  editError: string | null;
  pending: { updates: number; deletes: number };
  sessionMatchesEditor: boolean;
  confirmingApply: boolean;
  onEnterEdit: () => void;
  onRequestApply: () => void;
  onConfirmApply: () => void;
  onCancelApply: () => void;
  onDiscard: () => void;
  onCancel?: () => void;
  virtualQuery?: { queryId: string; totalRows: number; time: number; pageSize: number };
}
