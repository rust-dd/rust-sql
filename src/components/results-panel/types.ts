export type PanelView = "grid" | "record" | "history" | "explain" | "diff" | "map";

export interface EditState {
  schema: string;
  table: string;
  pkColumns: string[];
  cellEdits: Map<string, string>;
  deletedRows: Set<number>;
}

export interface ToolbarProps {
  panelView: PanelView;
  setPanelView: (v: PanelView) => void;
  result: { rows: string[][]; time: number; capped?: boolean } | null;
  columns: string[];
  filteredRows: string[][];
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  filteredCount: number;
  setViewMode: (mode: "grid" | "record") => void;
  viewMode: "grid" | "record";
  hasExplain: boolean;
  isExecuting: boolean;
  isEditing: boolean;
  editState: EditState | null;
  editableTable: boolean;
  isCommitting: boolean;
  editError: string | null;
  onEnterEdit: () => void;
  onCommit: () => void;
  onDeleteRows: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  pendingDeleteCount: number;
  onDiscard: () => void;
  onCancel?: () => void;
  virtualQuery?: { queryId: string; totalRows: number; time: number; pageSize: number };
}
