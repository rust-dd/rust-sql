import type * as Monaco from "monaco-editor";
import { useProjectStore } from "@/stores/project-store";
import { useTabStore } from "@/stores/tab-store";
import { DriverFactory } from "@/lib/database-driver";
import type { TableInfo } from "@/types";

type TableRef = { schema?: string; table: string };

function stripQuotes(s: string) {
  return s.replaceAll('"', "");
}

function extractAliasMap(sql: string): Record<string, TableRef> {
  const map: Record<string, TableRef> = {};
  const re =
    /(from|join)\s+("?[A-Za-z0-9_]+"?)(?:\s*\.\s*("?[A-Za-z0-9_]+"?))?(?:\s+as)?\s+("?[A-Za-z0-9_]+"?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const schemaMaybe = m[3] ? stripQuotes(m[2]) : undefined;
    const table = stripQuotes(m[3] ?? m[2]);
    const alias = stripQuotes(m[4]);
    map[alias] = { schema: schemaMaybe, table };
  }
  return map;
}

function genAlias(table: string) {
  const raw = table.replace(/"/g, "");
  const parts = raw.split("_").filter(Boolean);
  if (parts.length === 0) return raw.slice(0, 1);
  if (parts.length === 1) return parts[0].slice(0, 1);
  return parts.map((p) => p[0]).join("");
}

async function resolveTableRef(
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
        useProjectStore.setState((s) => ({
          tables: { ...s.tables, [key]: t! },
        }));
      } catch {
        continue;
      }
    }
    if (t && t.some((ti: TableInfo) => ti.name === ref.table)) {
      return { schema, table: ref.table };
    }
  }
  return { schema: "public", table: ref.table };
}

async function ensureColumns(
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
    useProjectStore.setState((s) => ({
      columns: { ...s.columns, [colKey]: cols },
    }));
    return cols;
  } catch {
    return [];
  }
}

async function ensureTables(
  projectId: string,
  schema: string,
): Promise<TableInfo[]> {
  const key = `${projectId}::${schema}`;
  const state = useProjectStore.getState();
  if (state.tables[key]) return state.tables[key];

  const d = state.projects[projectId];
  if (!d) return [];
  const driver = DriverFactory.getDriver(d.driver);

  try {
    const rawRows = await driver.loadTables(projectId, schema);
    const t = rawRows.map(([name, size]) => ({ name, size }));
    useProjectStore.setState((s) => ({
      tables: { ...s.tables, [key]: t },
    }));
    return t;
  } catch {
    return [];
  }
}

export function registerContextAwareCompletions(monaco: typeof Monaco) {
  monaco.languages.registerCompletionItemProvider("pgsql", {
    triggerCharacters: [".", " ", '"'],
    provideCompletionItems: async (model, position) => {
      const { tabs, selectedTabIndex } = useTabStore.getState();
      const activeTab = tabs[selectedTabIndex];
      const projectId = activeTab?.projectId;
      if (!projectId) return { suggestions: [] };

      const state = useProjectStore.getState();
      const d = state.projects[projectId];
      if (!d) return { suggestions: [] };

      const textUntilPosition = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });
      const context = textUntilPosition.slice(-1000);
      const aliasMap = extractAliasMap(context);
      const suggestions: any[] = [];

      const add = (
        label: string,
        kind: Monaco.languages.CompletionItemKind,
        insert?: string,
        snippet?: boolean,
      ) => {
        const item: any = {
          label,
          kind,
          insertText: insert ?? label,
          range: undefined,
        };
        if (snippet) {
          item.insertTextRules =
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
        }
        suggestions.push(item);
      };

      const lowCtx = context.toLowerCase();
      const tableCtx = /([a-z0-9_"]+)\s*\.\s*([a-z0-9_"]*)$/.exec(lowCtx);

      if (tableCtx) {
        const origCtx = /([A-Za-z0-9_"]+)\s*\.\s*([A-Za-z0-9_"]*)$/.exec(context);
        if (origCtx) {
          const left = stripQuotes(origCtx[1]);
          const right = stripQuotes(origCtx[2]);

          // Alias -> column completion
          if (aliasMap[left]) {
            const resolved = await resolveTableRef(projectId, aliasMap[left]);
            if (resolved) {
              const cols = await ensureColumns(projectId, resolved.schema, resolved.table);
              cols.forEach((c) =>
                add(c, monaco.languages.CompletionItemKind.Property, `"${c}"`),
              );
              return { suggestions };
            }
          }

          // schema. -> table completion
          if (right.length === 0) {
            const t = await ensureTables(projectId, left);
            for (const ti of t) {
              const alias = genAlias(ti.name);
              add(
                `${left}.${ti.name} ${alias}`,
                monaco.languages.CompletionItemKind.Field,
                `"${left}"."${ti.name}" \${1:${alias}}`,
                true,
              );
            }
            return { suggestions };
          }

          // schema.table. -> column completion
          const cols = await ensureColumns(projectId, left, right);
          cols.forEach((c) =>
            add(c, monaco.languages.CompletionItemKind.Property, `"${c}"`),
          );
          return { suggestions };
        }
      }

      // FROM/JOIN context -> table completion
      const fromCtx = /(from|join)\s+([A-Za-z0-9_".]*)$/.exec(lowCtx);
      if (fromCtx) {
        const projSchemas = state.schemas[projectId] || [];
        for (const schema of projSchemas) {
          const t = await ensureTables(projectId, schema);
          for (const ti of t) {
            const alias = genAlias(ti.name);
            add(
              `${schema}.${ti.name} ${alias}`,
              monaco.languages.CompletionItemKind.Field,
              `"${schema}"."${ti.name}" \${1:${alias}}`,
              true,
            );
          }
        }
        return { suggestions };
      }

      // Default: schema completion
      const projSchemas = state.schemas[projectId] || [];
      projSchemas.forEach((s) =>
        add(s, monaco.languages.CompletionItemKind.Module, `"${s}"`),
      );
      return { suggestions };
    },
  });
}
