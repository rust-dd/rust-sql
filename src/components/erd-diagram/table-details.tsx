import { useMemo } from "react";
import type { ForeignKey } from "./types";

/**
 * Derives connection metadata for the currently hovered table.
 *
 * Returns the set of table names connected to the hovered table by a
 * foreign key (in either direction) and the set of FK indices that
 * touch the hovered table — used by the renderer to highlight related
 * tables and dim everything else.
 */
export function useTableDetails(hoveredTable: string | null, fks: ForeignKey[]) {
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

  return { connectedTables, connectedFKs };
}
