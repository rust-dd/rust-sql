import type { ERDColumn, ForeignKey, TableBox } from "./types";

export const COL_HEIGHT = 22;
export const HEADER_HEIGHT = 32;
export const TABLE_PAD = 8;
export const MIN_TABLE_WIDTH = 200;
export const CHAR_WIDTH = 7;
export const TABLE_GAP_X = 80;
export const TABLE_GAP_Y = 50;
export const SHADOW_FILTER_ID = "erd-shadow";

export function measureTableWidth(name: string, columns: ERDColumn[]): number {
  let maxLen = name.length;
  for (const col of columns) {
    const line = `${col.name}  ${col.type}`;
    if (line.length > maxLen) maxLen = line.length;
  }
  return Math.max(MIN_TABLE_WIDTH, maxLen * CHAR_WIDTH + 40);
}

export function layoutTables(
  tables: { name: string; columns: ERDColumn[] }[],
  fks: ForeignKey[],
): TableBox[] {
  if (tables.length === 0) return [];

  const adj = new Map<string, Set<string>>();
  for (const t of tables) adj.set(t.name, new Set());
  for (const fk of fks) {
    adj.get(fk.sourceTable)?.add(fk.targetTable);
    adj.get(fk.targetTable)?.add(fk.sourceTable);
  }

  const sorted = [...tables].sort((a, b) => {
    const ac = adj.get(a.name)?.size ?? 0;
    const bc = adj.get(b.name)?.size ?? 0;
    if (bc !== ac) return bc - ac;
    return a.name.localeCompare(b.name);
  });

  const gridCols = Math.max(1, Math.ceil(Math.sqrt(sorted.length)));
  const boxes: TableBox[] = [];
  let col = 0;
  let y = 30;
  let maxRowHeight = 0;
  const colXOffsets: number[] = [];
  let currentX = 30;

  for (let i = 0; i < gridCols; i++) {
    colXOffsets.push(currentX);
    const colTables = sorted.filter((_, idx) => idx % gridCols === i);
    const maxWidth = colTables.reduce((max, t) => {
      const w = measureTableWidth(t.name, t.columns);
      return w > max ? w : max;
    }, MIN_TABLE_WIDTH);
    currentX += maxWidth + TABLE_GAP_X;
  }

  for (const t of sorted) {
    const width = measureTableWidth(t.name, t.columns);
    const height = HEADER_HEIGHT + t.columns.length * COL_HEIGHT + TABLE_PAD;
    const x = colXOffsets[col] ?? 30;

    boxes.push({ ...t, x, y, width, height });

    if (height > maxRowHeight) maxRowHeight = height;
    col++;
    if (col >= gridCols) {
      col = 0;
      y += maxRowHeight + TABLE_GAP_Y;
      maxRowHeight = 0;
    }
  }

  return boxes;
}
