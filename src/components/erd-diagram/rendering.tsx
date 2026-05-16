import { COL_HEIGHT, HEADER_HEIGHT, SHADOW_FILTER_ID } from "./layout";
import type { ForeignKey, TableBox } from "./types";

export function ERDDefs() {
  return (
    <defs>
      <filter id={SHADOW_FILTER_ID} x="-5%" y="-5%" width="110%" height="110%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.1" />
      </filter>
      {/* Arrow marker */}
      <marker id="erd-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
        <path d="M 0 0 L 8 4 L 0 8 Z" fill="var(--color-primary)" />
      </marker>
    </defs>
  );
}

export function ERDGridBackground({
  totalWidth,
  totalHeight,
}: {
  totalWidth: number;
  totalHeight: number;
}) {
  return (
    <>
      <pattern id="erd-grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="10" cy="10" r="0.5" fill="var(--color-border)" opacity="0.5" />
      </pattern>
      <rect width={totalWidth} height={totalHeight} fill="url(#erd-grid)" />
    </>
  );
}

interface FKLinesProps {
  fks: ForeignKey[];
  boxMap: Map<string, TableBox>;
  hoveredTable: string | null;
  connectedFKs: Set<number>;
}

export function ERDFKLines({ fks, boxMap, hoveredTable, connectedFKs }: FKLinesProps) {
  return (
    <>
      {fks.map((fk, i) => {
        const src = boxMap.get(fk.sourceTable);
        const tgt = boxMap.get(fk.targetTable);
        if (!src || !tgt) return null;

        const srcIdx = src.columns.findIndex((c) => c.name === fk.sourceColumn);
        const tgtIdx = tgt.columns.findIndex((c) => c.name === fk.targetColumn);
        const srcY =
          src.y + HEADER_HEIGHT + (srcIdx >= 0 ? srcIdx : 0) * COL_HEIGHT + COL_HEIGHT / 2;
        const tgtY =
          tgt.y + HEADER_HEIGHT + (tgtIdx >= 0 ? tgtIdx : 0) * COL_HEIGHT + COL_HEIGHT / 2;

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
            <circle
              cx={x1}
              cy={srcY}
              r={3}
              fill={isHighlighted ? "var(--color-primary)" : "var(--color-muted-foreground)"}
            />
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
    </>
  );
}

interface TableBoxesProps {
  boxes: TableBox[];
  hoveredTable: string | null;
  connectedTables: Set<string>;
  onMouseDown: (e: React.MouseEvent, tableName?: string) => void;
  onTableEnter: (name: string) => void;
  onTableLeave: () => void;
}

export function ERDTableBoxes({
  boxes,
  hoveredTable,
  connectedTables,
  onMouseDown,
  onTableEnter,
  onTableLeave,
}: TableBoxesProps) {
  return (
    <>
      {boxes.map((box) => {
        const isHovered = hoveredTable === box.name;
        const isConnected = connectedTables.has(box.name);
        const dimmed = hoveredTable !== null && !isHovered && !isConnected;

        return (
          <g
            key={box.name}
            opacity={dimmed ? 0.25 : 1}
            style={{ transition: "opacity 0.15s ease" }}
            onMouseDown={(e) => onMouseDown(e, box.name)}
            onMouseEnter={() => onTableEnter(box.name)}
            onMouseLeave={() => onTableLeave()}
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
              {box.name.length > 28 ? `${box.name.slice(0, 26)}..` : box.name}
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
    </>
  );
}
