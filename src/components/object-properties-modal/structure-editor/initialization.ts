import type {
  DraftColumn,
  DraftForeignKey,
  DraftIndex,
  DraftPrimaryKey,
  DraftUniqueConstraint,
  StructureEditorState,
} from "@/lib/alter-table-sql";
import type { FKInfo } from "../types";

export type StructureSubTab =
  | "columns"
  | "pk"
  | "fkeys"
  | "unique"
  | "indexes";

export function uid() {
  return crypto.randomUUID();
}

export function initStructureState(
  cols: import("@/types").ColumnDetail[] | undefined,
  idxs: import("@/types").IndexDetail[] | undefined,
  cons: import("@/types").ConstraintDetail[] | undefined,
  outgoingFKs: FKInfo[],
): StructureEditorState {
  const columns: DraftColumn[] = (cols ?? []).map((c) => ({
    _id: uid(),
    _status: "existing" as const,
    name: c.name,
    dataType: c.dataType,
    nullable: c.nullable,
    defaultValue: c.defaultValue,
    originalName: c.name,
    originalDataType: c.dataType,
    originalNullable: c.nullable,
    originalDefault: c.defaultValue,
  }));

  // Primary key from indexes
  const pkEntries = (idxs ?? []).filter((i) => i.isPrimary);
  const pkName = pkEntries[0]?.indexName ?? "";
  const primaryKey: DraftPrimaryKey | null =
    pkEntries.length > 0
      ? {
          constraintName: pkName,
          columns: pkEntries.map((e) => e.columnName),
          _status: "existing",
          originalColumns: pkEntries.map((e) => e.columnName),
        }
      : null;

  // Unique constraints from constraints
  const uniqueMap = new Map<string, string[]>();
  for (const c of cons ?? []) {
    if (c.constraintType === "UNIQUE") {
      const existing = uniqueMap.get(c.constraintName) ?? [];
      existing.push(c.columnName);
      uniqueMap.set(c.constraintName, existing);
    }
  }
  const uniqueConstraints: DraftUniqueConstraint[] = [
    ...uniqueMap.entries(),
  ].map(([name, ucCols]) => ({
    _id: uid(),
    _status: "existing" as const,
    constraintName: name,
    columns: ucCols,
  }));

  // Non-primary, non-unique indexes
  const idxMap = new Map<string, { columns: string[]; isUnique: boolean }>();
  for (const i of idxs ?? []) {
    if (i.isPrimary) continue;
    // Skip indexes that back a unique constraint
    if (uniqueMap.has(i.indexName)) continue;
    const existing = idxMap.get(i.indexName) ?? {
      columns: [],
      isUnique: i.isUnique,
    };
    existing.columns.push(i.columnName);
    idxMap.set(i.indexName, existing);
  }
  const indexes: DraftIndex[] = [...idxMap.entries()].map(([name, info]) => ({
    _id: uid(),
    _status: "existing" as const,
    indexName: name,
    columns: info.columns,
    isUnique: info.isUnique,
  }));

  // Foreign keys: group by constraintName
  const fkMap = new Map<string, FKInfo[]>();
  for (const fk of outgoingFKs) {
    const existing = fkMap.get(fk.constraintName) ?? [];
    existing.push(fk);
    fkMap.set(fk.constraintName, existing);
  }
  const foreignKeys: DraftForeignKey[] = [...fkMap.entries()].map(
    ([name, fks]) => ({
      _id: uid(),
      _status: "existing" as const,
      constraintName: name,
      sourceColumns: fks.map((f) => f.sourceColumn),
      targetSchema: fks[0].targetSchema,
      targetTable: fks[0].targetTable,
      targetColumns: fks.map((f) => f.targetColumn),
      onUpdate: fks[0].onUpdate,
      onDelete: fks[0].onDelete,
    }),
  );

  return { columns, primaryKey, foreignKeys, uniqueConstraints, indexes };
}
