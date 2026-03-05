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

      // Default: schema completion + snippets
      const projSchemas = state.schemas[projectId] || [];
      projSchemas.forEach((s) =>
        add(s, monaco.languages.CompletionItemKind.Module, `"${s}"`),
      );

      // SQL snippets
      for (const snip of SQL_SNIPPETS) {
        add(snip.label, monaco.languages.CompletionItemKind.Snippet, snip.insert, true);
      }

      return { suggestions };
    },
  });
}

const SQL_SNIPPETS = [
  { label: "sel", insert: "SELECT ${1:*}\nFROM ${2:table_name}\nWHERE ${3:condition}\nLIMIT ${4:100};" },
  { label: "selc", insert: "SELECT COUNT(*)\nFROM ${1:table_name}\nWHERE ${2:1=1};" },
  { label: "seld", insert: "SELECT DISTINCT ${1:column}\nFROM ${2:table_name};" },
  { label: "ins", insert: "INSERT INTO ${1:table_name} (${2:columns})\nVALUES (${3:values});" },
  { label: "upd", insert: "UPDATE ${1:table_name}\nSET ${2:column} = ${3:value}\nWHERE ${4:condition};" },
  { label: "del", insert: "DELETE FROM ${1:table_name}\nWHERE ${2:condition};" },
  { label: "crt", insert: "CREATE TABLE ${1:table_name} (\n  ${2:id} SERIAL PRIMARY KEY,\n  ${3:column} ${4:TEXT} NOT NULL\n);" },
  { label: "alt", insert: "ALTER TABLE ${1:table_name}\nADD COLUMN ${2:column_name} ${3:TEXT};" },
  { label: "idx", insert: "CREATE INDEX ${1:idx_name}\nON ${2:table_name} (${3:column});" },
  { label: "jn", insert: "SELECT ${1:*}\nFROM ${2:table1} t1\nJOIN ${3:table2} t2 ON t1.${4:id} = t2.${5:t1_id}\nWHERE ${6:1=1};" },
  { label: "lj", insert: "SELECT ${1:*}\nFROM ${2:table1} t1\nLEFT JOIN ${3:table2} t2 ON t1.${4:id} = t2.${5:t1_id};" },
  { label: "grp", insert: "SELECT ${1:column}, COUNT(*)\nFROM ${2:table_name}\nGROUP BY ${1:column}\nORDER BY COUNT(*) DESC;" },
  { label: "cte", insert: "WITH ${1:cte_name} AS (\n  SELECT ${2:*}\n  FROM ${3:table_name}\n  WHERE ${4:condition}\n)\nSELECT * FROM ${1:cte_name};" },
  { label: "exist", insert: "SELECT *\nFROM ${1:table_name} t1\nWHERE EXISTS (\n  SELECT 1\n  FROM ${2:other_table} t2\n  WHERE t2.${3:fk} = t1.${4:id}\n);" },
  { label: "upsert", insert: "INSERT INTO ${1:table_name} (${2:columns})\nVALUES (${3:values})\nON CONFLICT (${4:constraint})\nDO UPDATE SET ${5:column} = EXCLUDED.${5:column};" },
  { label: "vw", insert: "CREATE OR REPLACE VIEW ${1:view_name} AS\nSELECT ${2:*}\nFROM ${3:table_name}\nWHERE ${4:condition};" },
  { label: "fn", insert: "CREATE OR REPLACE FUNCTION ${1:func_name}(${2:params})\nRETURNS ${3:return_type}\nLANGUAGE plpgsql\nAS \\$\\$\nBEGIN\n  ${4:-- body}\nEND;\n\\$\\$;" },
  { label: "trg", insert: "CREATE TRIGGER ${1:trigger_name}\n${2:BEFORE} ${3:INSERT} ON ${4:table_name}\nFOR EACH ROW\nEXECUTE FUNCTION ${5:func_name}();" },
  { label: "txn", insert: "BEGIN;\n  ${1:-- statements}\nCOMMIT;" },
];
