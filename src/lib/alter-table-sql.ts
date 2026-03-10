import { quoteIdent } from "./sql-utils";

export type DraftStatus = "existing" | "added" | "modified" | "removed";

export interface DraftColumn {
  _id: string;
  _status: DraftStatus;
  name: string;
  originalName?: string;
  dataType: string;
  nullable: boolean;
  defaultValue: string | null;
  originalDataType?: string;
  originalNullable?: boolean;
  originalDefault?: string | null;
}

export interface DraftPrimaryKey {
  constraintName: string;
  columns: string[];
  _status: DraftStatus;
  originalColumns?: string[];
}

export interface DraftForeignKey {
  _id: string;
  _status: DraftStatus;
  constraintName: string;
  sourceColumns: string[];
  targetSchema: string;
  targetTable: string;
  targetColumns: string[];
  onUpdate: string;
  onDelete: string;
}

export interface DraftUniqueConstraint {
  _id: string;
  _status: DraftStatus;
  constraintName: string;
  columns: string[];
}

export interface DraftIndex {
  _id: string;
  _status: DraftStatus;
  indexName: string;
  columns: string[];
  isUnique: boolean;
}

export interface StructureEditorState {
  columns: DraftColumn[];
  primaryKey: DraftPrimaryKey | null;
  foreignKeys: DraftForeignKey[];
  uniqueConstraints: DraftUniqueConstraint[];
  indexes: DraftIndex[];
}

export const PG_COMMON_TYPES = [
  "integer",
  "bigint",
  "smallint",
  "serial",
  "bigserial",
  "text",
  "varchar",
  "char",
  "boolean",
  "date",
  "timestamp",
  "timestamptz",
  "time",
  "timetz",
  "interval",
  "numeric",
  "real",
  "double precision",
  "money",
  "uuid",
  "json",
  "jsonb",
  "bytea",
  "inet",
  "cidr",
  "macaddr",
  "point",
  "line",
  "polygon",
  "box",
  "xml",
  "tsquery",
  "tsvector",
  "int[]",
  "text[]",
  "jsonb[]",
];

export const FK_ACTIONS = [
  "NO ACTION",
  "RESTRICT",
  "CASCADE",
  "SET NULL",
  "SET DEFAULT",
];

export function generateAlterTableSQL(
  schema: string,
  table: string,
  original: StructureEditorState,
  draft: StructureEditorState,
): string[] {
  const stmts: string[] = [];
  const target = `${quoteIdent(schema)}.${quoteIdent(table)}`;

  // 1. Drop removed foreign keys
  for (const fk of draft.foreignKeys) {
    if (fk._status === "removed") {
      stmts.push(
        `ALTER TABLE ${target} DROP CONSTRAINT ${quoteIdent(fk.constraintName)};`,
      );
    }
  }

  // 2. Drop removed unique constraints
  for (const uc of draft.uniqueConstraints) {
    if (uc._status === "removed") {
      stmts.push(
        `ALTER TABLE ${target} DROP CONSTRAINT ${quoteIdent(uc.constraintName)};`,
      );
    }
  }

  // 3. Drop removed indexes
  for (const idx of draft.indexes) {
    if (idx._status === "removed") {
      stmts.push(
        `DROP INDEX ${quoteIdent(schema)}.${quoteIdent(idx.indexName)};`,
      );
    }
  }

  // 4. Drop PK if changed or removed
  if (original.primaryKey && draft.primaryKey?._status === "removed") {
    stmts.push(
      `ALTER TABLE ${target} DROP CONSTRAINT ${quoteIdent(original.primaryKey.constraintName)};`,
    );
  } else if (draft.primaryKey?._status === "modified" && original.primaryKey) {
    stmts.push(
      `ALTER TABLE ${target} DROP CONSTRAINT ${quoteIdent(original.primaryKey.constraintName)};`,
    );
  }

  // 5. Drop removed columns
  for (const col of draft.columns) {
    if (col._status === "removed") {
      stmts.push(`ALTER TABLE ${target} DROP COLUMN ${quoteIdent(col.name)};`);
    }
  }

  // 6. Add new columns
  for (const col of draft.columns) {
    if (col._status === "added") {
      let stmt = `ALTER TABLE ${target} ADD COLUMN ${quoteIdent(col.name)} ${col.dataType}`;
      if (!col.nullable) stmt += " NOT NULL";
      if (col.defaultValue) stmt += ` DEFAULT ${col.defaultValue}`;
      stmts.push(stmt + ";");
    }
  }

  // 7. Modify existing columns
  for (const col of draft.columns) {
    if (col._status === "modified") {
      // Rename
      if (col.originalName && col.originalName !== col.name) {
        stmts.push(
          `ALTER TABLE ${target} RENAME COLUMN ${quoteIdent(col.originalName)} TO ${quoteIdent(col.name)};`,
        );
      }

      const effectiveName = col.name;

      // Type change
      if (col.originalDataType && col.originalDataType !== col.dataType) {
        stmts.push(
          `ALTER TABLE ${target} ALTER COLUMN ${quoteIdent(effectiveName)} TYPE ${col.dataType} USING ${quoteIdent(effectiveName)}::${col.dataType};`,
        );
      }

      // Nullable change
      if (
        col.originalNullable !== undefined &&
        col.originalNullable !== col.nullable
      ) {
        if (col.nullable) {
          stmts.push(
            `ALTER TABLE ${target} ALTER COLUMN ${quoteIdent(effectiveName)} DROP NOT NULL;`,
          );
        } else {
          stmts.push(
            `ALTER TABLE ${target} ALTER COLUMN ${quoteIdent(effectiveName)} SET NOT NULL;`,
          );
        }
      }

      // Default change
      if (
        col.originalDefault !== undefined &&
        col.originalDefault !== col.defaultValue
      ) {
        if (col.defaultValue) {
          stmts.push(
            `ALTER TABLE ${target} ALTER COLUMN ${quoteIdent(effectiveName)} SET DEFAULT ${col.defaultValue};`,
          );
        } else {
          stmts.push(
            `ALTER TABLE ${target} ALTER COLUMN ${quoteIdent(effectiveName)} DROP DEFAULT;`,
          );
        }
      }
    }
  }

  // 8. Add PK
  if (
    draft.primaryKey &&
    (draft.primaryKey._status === "added" ||
      draft.primaryKey._status === "modified")
  ) {
    const pkCols = draft.primaryKey.columns.map(quoteIdent).join(", ");
    stmts.push(
      `ALTER TABLE ${target} ADD CONSTRAINT ${quoteIdent(draft.primaryKey.constraintName)} PRIMARY KEY (${pkCols});`,
    );
  }

  // 9. Add unique constraints
  for (const uc of draft.uniqueConstraints) {
    if (uc._status === "added") {
      const ucCols = uc.columns.map(quoteIdent).join(", ");
      stmts.push(
        `ALTER TABLE ${target} ADD CONSTRAINT ${quoteIdent(uc.constraintName)} UNIQUE (${ucCols});`,
      );
    }
  }

  // 10. Add indexes
  for (const idx of draft.indexes) {
    if (idx._status === "added") {
      const idxCols = idx.columns.map(quoteIdent).join(", ");
      const unique = idx.isUnique ? "UNIQUE " : "";
      stmts.push(
        `CREATE ${unique}INDEX ${quoteIdent(idx.indexName)} ON ${target} (${idxCols});`,
      );
    }
  }

  // 11. Add foreign keys
  for (const fk of draft.foreignKeys) {
    if (fk._status === "added") {
      const srcCols = fk.sourceColumns.map(quoteIdent).join(", ");
      const tgtCols = fk.targetColumns.map(quoteIdent).join(", ");
      const tgtTable = `${quoteIdent(fk.targetSchema)}.${quoteIdent(fk.targetTable)}`;
      stmts.push(
        `ALTER TABLE ${target} ADD CONSTRAINT ${quoteIdent(fk.constraintName)} ` +
          `FOREIGN KEY (${srcCols}) REFERENCES ${tgtTable} (${tgtCols}) ` +
          `ON UPDATE ${fk.onUpdate} ON DELETE ${fk.onDelete};`,
      );
    }
  }

  return stmts;
}

export function countChanges(state: StructureEditorState): number {
  let count = 0;
  for (const col of state.columns) {
    if (col._status !== "existing") count++;
  }
  if (state.primaryKey && state.primaryKey._status !== "existing") count++;
  for (const fk of state.foreignKeys) {
    if (fk._status !== "existing") count++;
  }
  for (const uc of state.uniqueConstraints) {
    if (uc._status !== "existing") count++;
  }
  for (const idx of state.indexes) {
    if (idx._status !== "existing") count++;
  }
  return count;
}
