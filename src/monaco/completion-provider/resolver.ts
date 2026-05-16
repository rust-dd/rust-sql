import { DriverFactory } from "@/lib/database-driver";
import { useProjectStore } from "@/stores/project-store";
import type { TableInfo } from "@/types";
import type { TableRef } from "./alias-parser";

export async function resolveTableRef(
  projectId: string,
  ref: TableRef,
): Promise<{ schema: string; table: string } | null> {
  if (ref.schema) return { schema: ref.schema, table: ref.table };

  const state = useProjectStore.getState();
  const projSchemas = state.schemas[projectId] || [];
  const d = state.projects[projectId];
  if (!d) return { schema: "public", table: ref.table };

  const driver = DriverFactory.getDriver(d.driver);

  for (const schema of projSchemas) {
    const key = `${projectId}::${schema}`;
    let t = state.tables[key];
    if (!t) {
      try {
        const rawRows = await driver.loadTables(projectId, schema);
        t = rawRows.map(([name, size]) => ({ name, size }));
        useProjectStore.setState((s) => {
          s.tables[key] = t!;
        });
      } catch {
        continue;
      }
    }
    const match = t?.find((ti: TableInfo) => ti.name.toLowerCase() === ref.table.toLowerCase());
    if (match) {
      return { schema, table: match.name };
    }
  }
  return { schema: "public", table: ref.table };
}

export async function ensureColumns(
  projectId: string,
  schema: string,
  table: string,
): Promise<string[]> {
  const colKey = `${projectId}::${schema}::${table}`;
  const state = useProjectStore.getState();
  if (state.columns[colKey]) return state.columns[colKey];

  const d = state.projects[projectId];
  if (!d) return [];
  const driver = DriverFactory.getDriver(d.driver);

  try {
    const cols = await driver.loadColumns(projectId, schema, table);
    useProjectStore.setState((s) => {
      s.columns[colKey] = cols;
    });
    return cols;
  } catch {
    return [];
  }
}

export async function ensureTables(projectId: string, schema: string): Promise<TableInfo[]> {
  const key = `${projectId}::${schema}`;
  const state = useProjectStore.getState();
  if (state.tables[key]) return state.tables[key];

  const d = state.projects[projectId];
  if (!d) return [];
  const driver = DriverFactory.getDriver(d.driver);

  try {
    const rawRows = await driver.loadTables(projectId, schema);
    const t = rawRows.map(([name, size]) => ({ name, size }));
    useProjectStore.setState((s) => {
      s.tables[key] = t;
    });
    return t;
  } catch {
    return [];
  }
}
