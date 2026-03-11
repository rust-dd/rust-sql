import { useProjectStore } from "@/stores/project-store";

/**
 * Builds a rich schema context string for the AI, describing tables, columns,
 * primary keys, foreign keys, indexes, and constraints so it can write
 * accurate, informed SQL without asking unnecessary questions.
 */
export function buildSchemaContext(projectId: string): string {
  const state = useProjectStore.getState();
  const schemas = state.schemas[projectId] ?? [];
  const lines: string[] = [];

  for (const schema of schemas) {
    const tableKey = `${projectId}::${schema}`;
    const tables = state.tables[tableKey];
    if (!tables || tables.length === 0) continue;

    lines.push(`-- Schema: ${schema}`);

    for (const table of tables) {
      const colKey = `${projectId}::${schema}::${table.name}`;
      const cols = state.columnDetails[colKey];
      const constraints = state.constraints[colKey] ?? [];
      const indexes = state.indexes[colKey] ?? [];

      // Collect PKs and FKs from constraints
      const pkCols = constraints
        .filter((c) => c.constraintType === "PRIMARY KEY")
        .map((c) => c.columnName);
      const fks = constraints.filter((c) => c.constraintType === "FOREIGN KEY");
      const uniqueConstraints = constraints.filter((c) => c.constraintType === "UNIQUE");

      // Build CREATE TABLE-like representation
      const colDefs: string[] = [];
      if (cols && cols.length > 0) {
        for (const c of cols) {
          let def = `  ${c.name} ${c.dataType}`;
          if (!c.nullable) def += " NOT NULL";
          if (c.defaultValue) def += ` DEFAULT ${c.defaultValue}`;
          if (pkCols.includes(c.name)) def += " PRIMARY KEY";
          colDefs.push(def);
        }
      }

      // FK lines
      for (const fk of fks) {
        colDefs.push(
          `  -- FK: ${fk.columnName} -> ${fk.constraintName}`,
        );
      }

      // Unique constraints (non-PK)
      for (const uc of uniqueConstraints) {
        colDefs.push(`  -- UNIQUE(${uc.columnName})`);
      }

      if (colDefs.length > 0) {
        lines.push(`CREATE TABLE ${schema}.${table.name} (`);
        lines.push(colDefs.join(",\n"));
        lines.push(");");
      } else {
        lines.push(`-- Table: ${schema}.${table.name} (columns not loaded)`);
      }

      // Notable indexes (non-PK, non-unique-constraint)
      const extraIndexes = indexes.filter((idx) => !idx.isPrimary);
      if (extraIndexes.length > 0) {
        for (const idx of extraIndexes) {
          const u = idx.isUnique ? "UNIQUE " : "";
          lines.push(
            `-- ${u}INDEX ${idx.indexName} ON ${schema}.${table.name}(${idx.columnName});`,
          );
        }
      }

      lines.push("");
    }

    // Views
    const views = state.views[tableKey];
    if (views && views.length > 0) {
      lines.push(`-- Views: ${views.join(", ")}`);
    }

    // Materialized views
    const mvs = state.materializedViews[tableKey];
    if (mvs && mvs.length > 0) {
      lines.push(`-- Materialized Views: ${mvs.join(", ")}`);
    }

    // Functions
    const funcs = state.functions[tableKey];
    if (funcs && funcs.length > 0) {
      lines.push(
        `-- Functions: ${funcs.map((f) => `${f.name}(${f.arguments || ""})`).join(", ")}`,
      );
    }
  }

  if (lines.length === 0) return "";

  return (
    "The following is the database schema. Use this to write accurate SQL.\n" +
    "Do NOT ask the user about table/column names — use this schema.\n\n" +
    lines.join("\n")
  );
}
