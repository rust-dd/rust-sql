import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useProjectStore } from "@/stores/project-store";
import { DriverFactory, type ForeignKey } from "@/lib/database-driver";
import type { ColumnDetail, IndexDetail } from "@/types";
import { Loader2, ZoomIn, ZoomOut, Maximize, Download } from "lucide-react";

interface ERDProps {
  projectId: string;
  schema: string;
}

interface ERDColumn {
  name: string;
  type: string;
  nullable: boolean;
  isPK: boolean;
  isFK: boolean;
}

interface TableBox {
  name: string;
  columns: ERDColumn[];
  x: number;
  y: number;
  width: number;
  height: number;
}

const COL_HEIGHT = 22;
const HEADER_HEIGHT = 32;
const TABLE_PAD = 8;
const MIN_TABLE_WIDTH = 200;
const CHAR_WIDTH = 7;
const TABLE_GAP_X = 80;
const TABLE_GAP_Y = 50;
const SHADOW_FILTER_ID = "erd-shadow";

function measureTableWidth(name: string, columns: ERDColumn[]): number {
  let maxLen = name.length;
  for (const col of columns) {
    const line = `${col.name}  ${col.type}`;
    if (line.length > maxLen) maxLen = line.length;
  }
  return Math.max(MIN_TABLE_WIDTH, maxLen * CHAR_WIDTH + 40);
}

function layoutTables(
  tables: { name: string; columns: ERDColumn[] }[],
  fks: ForeignKey[],
): TableBox[] {
  if (tables.length === 0) return [];

  // Build adjacency for connected-component ordering
  const adj = new Map<string, Set<string>>();
  for (const t of tables) adj.set(t.name, new Set());
  for (const fk of fks) {
    adj.get(fk.sourceTable)?.add(fk.targetTable);
    adj.get(fk.targetTable)?.add(fk.sourceTable);
  }

  // Sort: most connected tables first, then alphabetically
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
    // Estimate width for this column based on tables that will go here
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

export function ERDDiagram({ projectId, schema }: ERDProps) {
  const [fks, setFks] = useState<ForeignKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [tablePositions, setTablePositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState<{ type: "pan" | "table"; tableName?: string } | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredTable, setHoveredTable] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const detailsLoadedRef = useRef(false);

  const tables = useProjectStore((s) => s.tables);
  const columnDetails = useProjectStore((s) => s.columnDetails);
  const indexes = useProjectStore((s) => s.indexes);
  const loadColumnDetails = useProjectStore((s) => s.loadColumnDetails);
  const loadIndexes = useProjectStore((s) => s.loadIndexes);
  const loadTables = useProjectStore((s) => s.loadTables);

  const key = `${projectId}::${schema}`;
  const schemaTables = tables[key] ?? [];

  // Load tables and FK data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    detailsLoadedRef.current = false;

    async function load() {
      // Read from store directly to avoid stale closure
      const d = useProjectStore.getState().projects[projectId];
      if (!d) {
        setLoading(false);
        return;
      }

      const driver = DriverFactory.getDriver(d.driver);

      // Step 1: load tables + FKs in parallel
      let loadedFks: ForeignKey[] = [];
      try {
        const [, fkResult] = await Promise.allSettled([
          loadTables(projectId, schema),
          driver.loadForeignKeys(projectId, schema),
        ]);
        if (fkResult.status === "fulfilled") {
          loadedFks = fkResult.value;
        } else {
          console.warn("ERD: Failed to load foreign keys:", fkResult.reason);
        }
      } catch (e) {
        console.warn("ERD: Error loading data:", e);
      }

      if (cancelled) return;
      setFks(loadedFks);

      // Step 2: get the current tables from the store
      const currentTables = useProjectStore.getState().tables[`${projectId}::${schema}`] ?? [];
      if (currentTables.length === 0) {
        setLoading(false);
        return;
      }

      // Step 3: load column details + indexes for all tables (fire-and-forget)
      const detailPromises = currentTables.map((t) => {
        const detailKey = `${projectId}::${schema}::${t.name}`;
        const state = useProjectStore.getState();
        const tasks: Promise<unknown>[] = [];
        if (!state.columnDetails[detailKey]) {
          tasks.push(loadColumnDetails(projectId, schema, t.name).catch(() => {}));
        }
        if (!state.indexes[detailKey]) {
          tasks.push(loadIndexes(projectId, schema, t.name).catch(() => {}));
        }
        return Promise.all(tasks);
      });

      Promise.all(detailPromises).finally(() => {
        if (!cancelled) detailsLoadedRef.current = true;
      });

      if (!cancelled) setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, schema]);

  // Derive whether we have enough detail data to render
  const detailsReady = schemaTables.length === 0 || schemaTables.some((t) => {
    const detailKey = `${projectId}::${schema}::${t.name}`;
    return columnDetails[detailKey] != null;
  });

  // Build ERD table data with column types and PK/FK info
  const tableData = useMemo(() => {
    if (!detailsReady) return [];

    const fkColumns = new Set<string>();
    for (const fk of fks) {
      fkColumns.add(`${fk.sourceTable}.${fk.sourceColumn}`);
      fkColumns.add(`${fk.targetTable}.${fk.targetColumn}`);
    }

    return schemaTables.map((t) => {
      const detailKey = `${projectId}::${schema}::${t.name}`;
      const details: ColumnDetail[] = columnDetails[detailKey] ?? [];
      const idxs: IndexDetail[] = indexes[detailKey] ?? [];
      const pkCols = new Set(idxs.filter((i) => i.isPrimary).map((i) => i.columnName));

      const cols: ERDColumn[] = details.map((d) => ({
        name: d.name,
        type: d.dataType,
        nullable: d.nullable,
        isPK: pkCols.has(d.name),
        isFK: fkColumns.has(`${t.name}.${d.name}`),
      }));

      return { name: t.name, columns: cols };
    });
  }, [schemaTables, columnDetails, indexes, fks, projectId, schema, detailsReady]);

  const initialBoxes = useMemo(() => layoutTables(tableData, fks), [tableData, fks]);

  // Apply custom positions from dragging
  const boxes = useMemo(() => {
    if (tablePositions.size === 0) return initialBoxes;
    return initialBoxes.map((b) => {
      const pos = tablePositions.get(b.name);
      return pos ? { ...b, x: pos.x, y: pos.y } : b;
    });
  }, [initialBoxes, tablePositions]);

  const boxMap = useMemo(() => new Map(boxes.map((b) => [b.name, b])), [boxes]);

  const totalWidth = Math.max(800, ...boxes.map((b) => b.x + b.width + 60));
  const totalHeight = Math.max(600, ...boxes.map((b) => b.y + b.height + 60));

  // Get connected tables for highlighting
  const connectedTables = useMemo(() => {
    if (!hoveredTable) return new Set<string>();
    const connected = new Set<string>();
    for (const fk of fks) {
      if (fk.sourceTable === hoveredTable) connected.add(fk.targetTable);
      if (fk.targetTable === hoveredTable) connected.add(fk.sourceTable);
    }
    return connected;
  }, [hoveredTable, fks]);

  const connectedFKs = useMemo(() => {
    if (!hoveredTable) return new Set<number>();
    const set = new Set<number>();
    fks.forEach((fk, i) => {
      if (fk.sourceTable === hoveredTable || fk.targetTable === hoveredTable) set.add(i);
    });
    return set;
  }, [hoveredTable, fks]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.min(3, Math.max(0.1, z * delta)));
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, tableName?: string) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      if (tableName) {
        const box = boxMap.get(tableName);
        if (!box) return;
        setDragging({ type: "table", tableName });
        setDragStart({ x: e.clientX / zoom - box.x, y: e.clientY / zoom - box.y });
      } else {
        setDragging({ type: "pan" });
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      }
    },
    [pan, zoom, boxMap],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      if (dragging.type === "pan") {
        setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
      } else if (dragging.type === "table" && dragging.tableName) {
        const newX = e.clientX / zoom - dragStart.x;
        const newY = e.clientY / zoom - dragStart.y;
        setTablePositions((prev) => {
          const next = new Map(prev);
          next.set(dragging.tableName!, { x: Math.max(0, newX), y: Math.max(0, newY) });
          return next;
        });
      }
    },
    [dragging, dragStart, zoom],
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  const fitToView = useCallback(() => {
    if (!containerRef.current || boxes.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = rect.width / totalWidth;
    const scaleY = rect.height / totalHeight;
    const newZoom = Math.min(scaleX, scaleY) * 0.9;
    setZoom(Math.min(2, Math.max(0.1, newZoom)));
    setPan({ x: 10, y: 10 });
  }, [boxes, totalWidth, totalHeight]);

  const exportSVG = useCallback(() => {
    if (!svgRef.current) return;
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", String(totalWidth));
    clone.setAttribute("height", String(totalHeight));
    const blob = new Blob([clone.outerHTML], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `erd-${schema}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [totalWidth, totalHeight, schema]);

  if (loading || (!detailsReady && schemaTables.length > 0)) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading ERD...</span>
      </div>
    );
  }

  if (boxes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <span className="text-sm">No tables found in schema "{schema}"</span>
      </div>
    );
  }

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-1">
        <button
          onClick={() => setZoom((z) => Math.min(3, z * 1.2))}
          className="p-1.5 rounded bg-card border border-border hover:bg-accent transition-colors shadow-sm"
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.1, z * 0.8))}
          className="p-1.5 rounded bg-card border border-border hover:bg-accent transition-colors shadow-sm"
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          onClick={fitToView}
          className="p-1.5 rounded bg-card border border-border hover:bg-accent transition-colors shadow-sm"
          title="Fit to view"
        >
          <Maximize className="h-4 w-4" />
        </button>
        <button
          onClick={exportSVG}
          className="p-1.5 rounded bg-card border border-border hover:bg-accent transition-colors shadow-sm"
          title="Export SVG"
        >
          <Download className="h-4 w-4" />
        </button>
      </div>

      {/* Status indicator */}
      <div className="absolute bottom-3 right-3 z-20 text-xs text-muted-foreground bg-card/80 border border-border rounded px-2 py-0.5 font-mono flex gap-2">
        <span>{boxes.length} tables</span>
        <span>{fks.length} FKs</span>
        <span>{Math.round(zoom * 100)}%</span>
      </div>

      {/* SVG Canvas */}
      <div
        ref={containerRef}
        className="h-full cursor-grab active:cursor-grabbing bg-background"
        onWheel={handleWheel}
        onMouseDown={(e) => handleMouseDown(e)}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${totalWidth} ${totalHeight}`}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          <defs>
            <filter id={SHADOW_FILTER_ID} x="-5%" y="-5%" width="110%" height="110%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.1" />
            </filter>
            {/* Arrow marker */}
            <marker id="erd-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M 0 0 L 8 4 L 0 8 Z" fill="var(--color-primary)" />
            </marker>
          </defs>

          {/* Grid dots background */}
          <pattern id="erd-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="0.5" fill="var(--color-border)" opacity="0.5" />
          </pattern>
          <rect width={totalWidth} height={totalHeight} fill="url(#erd-grid)" />

          {/* FK relationship lines */}
          {fks.map((fk, i) => {
            const src = boxMap.get(fk.sourceTable);
            const tgt = boxMap.get(fk.targetTable);
            if (!src || !tgt) return null;

            const srcIdx = src.columns.findIndex((c) => c.name === fk.sourceColumn);
            const tgtIdx = tgt.columns.findIndex((c) => c.name === fk.targetColumn);
            const srcY = src.y + HEADER_HEIGHT + (srcIdx >= 0 ? srcIdx : 0) * COL_HEIGHT + COL_HEIGHT / 2;
            const tgtY = tgt.y + HEADER_HEIGHT + (tgtIdx >= 0 ? tgtIdx : 0) * COL_HEIGHT + COL_HEIGHT / 2;

            const srcRight = src.x + src.width;
            const tgtLeft = tgt.x;
            const srcLeft = src.x;
            const tgtRight = tgt.x + tgt.width;

            let x1: number, x2: number;
            if (srcRight + 20 < tgtLeft) {
              x1 = srcRight;
              x2 = tgtLeft;
            } else if (tgtRight + 20 < srcLeft) {
              x1 = srcLeft;
              x2 = tgtRight;
            } else {
              x1 = srcRight;
              x2 = tgtRight + 30;
            }

            const isHighlighted = connectedFKs.has(i);
            const midX = (x1 + x2) / 2;
            const cpOffset = Math.max(40, Math.abs(x2 - x1) * 0.4);

            return (
              <g key={i} opacity={hoveredTable ? (isHighlighted ? 1 : 0.15) : 0.7}>
                <path
                  d={`M ${x1} ${srcY} C ${x1 + cpOffset} ${srcY}, ${x2 - cpOffset} ${tgtY}, ${x2} ${tgtY}`}
                  fill="none"
                  stroke={isHighlighted ? "var(--color-primary)" : "var(--color-muted-foreground)"}
                  strokeWidth={isHighlighted ? 2 : 1.5}
                  markerEnd="url(#erd-arrow)"
                />
                {/* One-to-many indicator: diamond at source, circle at target */}
                <circle cx={x1} cy={srcY} r={3} fill={isHighlighted ? "var(--color-primary)" : "var(--color-muted-foreground)"} />
                {/* Label */}
                {isHighlighted && (
                  <text
                    x={midX}
                    y={Math.min(srcY, tgtY) - 6}
                    fontSize={9}
                    fontFamily="monospace"
                    fill="var(--color-primary)"
                    textAnchor="middle"
                  >
                    {fk.sourceColumn} → {fk.targetColumn}
                  </text>
                )}
              </g>
            );
          })}

          {/* Table boxes */}
          {boxes.map((box) => {
            const isHovered = hoveredTable === box.name;
            const isConnected = connectedTables.has(box.name);
            const dimmed = hoveredTable !== null && !isHovered && !isConnected;

            return (
              <g
                key={box.name}
                opacity={dimmed ? 0.25 : 1}
                style={{ transition: "opacity 0.15s ease" }}
                onMouseDown={(e) => handleMouseDown(e, box.name)}
                onMouseEnter={() => setHoveredTable(box.name)}
                onMouseLeave={() => setHoveredTable(null)}
                className="cursor-grab active:cursor-grabbing"
              >
                {/* Shadow rect */}
                <rect
                  x={box.x}
                  y={box.y}
                  width={box.width}
                  height={box.height}
                  rx={6}
                  fill="var(--color-card)"
                  stroke={isHovered || isConnected ? "var(--color-primary)" : "var(--color-border)"}
                  strokeWidth={isHovered ? 2 : 1}
                  filter={`url(#${SHADOW_FILTER_ID})`}
                />
                {/* Header bg */}
                <rect
                  x={box.x}
                  y={box.y}
                  width={box.width}
                  height={HEADER_HEIGHT}
                  rx={6}
                  fill="var(--color-primary)"
                />
                {/* Header bottom rect to cover bottom corners */}
                <rect
                  x={box.x}
                  y={box.y + HEADER_HEIGHT - 6}
                  width={box.width}
                  height={6}
                  fill="var(--color-primary)"
                />
                {/* Table name */}
                <text
                  x={box.x + 10}
                  y={box.y + HEADER_HEIGHT / 2 + 5}
                  fontSize={12}
                  fontFamily="monospace"
                  fontWeight="bold"
                  fill="var(--color-primary-foreground)"
                >
                  {box.name.length > 28 ? box.name.slice(0, 26) + ".." : box.name}
                </text>

                {/* Column separator line */}
                <line
                  x1={box.x}
                  y1={box.y + HEADER_HEIGHT}
                  x2={box.x + box.width}
                  y2={box.y + HEADER_HEIGHT}
                  stroke="var(--color-border)"
                  strokeWidth={1}
                />

                {/* Columns */}
                {box.columns.map((col, ci) => {
                  const cy = box.y + HEADER_HEIGHT + ci * COL_HEIGHT;
                  const isAlt = ci % 2 === 1;

                  return (
                    <g key={col.name}>
                      {/* Alternating row bg */}
                      {isAlt && (
                        <rect
                          x={box.x + 1}
                          y={cy}
                          width={box.width - 2}
                          height={COL_HEIGHT}
                          fill="var(--color-muted)"
                          opacity={0.3}
                          rx={ci === box.columns.length - 1 ? 4 : 0}
                        />
                      )}
                      {/* PK/FK icon */}
                      {col.isPK && (
                        <text
                          x={box.x + 8}
                          y={cy + COL_HEIGHT / 2 + 4}
                          fontSize={10}
                          fill="var(--color-primary)"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          PK
                        </text>
                      )}
                      {col.isFK && !col.isPK && (
                        <text
                          x={box.x + 8}
                          y={cy + COL_HEIGHT / 2 + 4}
                          fontSize={10}
                          fill="var(--color-primary)"
                          fontFamily="monospace"
                          opacity={0.7}
                        >
                          FK
                        </text>
                      )}
                      {/* Column name */}
                      <text
                        x={box.x + (col.isPK || col.isFK ? 28 : 10)}
                        y={cy + COL_HEIGHT / 2 + 4}
                        fontSize={11}
                        fontFamily="monospace"
                        fill={col.isPK ? "var(--color-foreground)" : "var(--color-muted-foreground)"}
                        fontWeight={col.isPK ? "600" : "normal"}
                      >
                        {col.name}
                      </text>
                      {/* Column type */}
                      <text
                        x={box.x + box.width - 8}
                        y={cy + COL_HEIGHT / 2 + 4}
                        fontSize={10}
                        fontFamily="monospace"
                        fill="var(--color-muted-foreground)"
                        opacity={0.6}
                        textAnchor="end"
                      >
                        {col.type}
                        {!col.nullable ? "" : "?"}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
