import type * as Monaco from "monaco-editor";
import { useProjectStore } from "@/stores/project-store";
import { useTabStore } from "@/stores/tab-store";
import { DriverFactory } from "@/lib/database-driver";
import type { TableInfo } from "@/types";

type TableRef = { schema?: string; table: string };

let registered = false;

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
    const match =
      t &&
      t.find(
        (ti: TableInfo) => ti.name.toLowerCase() === ref.table.toLowerCase(),
      );
    if (match) {
      return { schema, table: match.name };
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
  if (registered) return;
  registered = true;

  monaco.languages.registerCompletionItemProvider("pgsql", {
    triggerCharacters: [".", " ", '"'],
    provideCompletionItems: async (model, position) => {
      const suggestions: any[] = [];

      const add = (
        label: string,
        kind: Monaco.languages.CompletionItemKind,
        insert?: string,
        snippet?: boolean,
        detail?: string,
      ) => {
        const item: any = {
          label,
          kind,
          insertText: insert ?? label,
          detail,
          range: undefined,
        };
        if (snippet) {
          item.insertTextRules =
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
        }
        suggestions.push(item);
      };

      const textUntilPosition = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });
      const context = textUntilPosition.slice(-1000);

      // Get active project context
      const { tabs, selectedTabIndex } = useTabStore.getState();
      const activeTab = tabs[selectedTabIndex];
      const projectId = activeTab?.projectId;
      const state = useProjectStore.getState();
      const d = projectId ? state.projects[projectId] : undefined;

      // Context-aware completions (require active connection)
      if (projectId && d) {
        const aliasMap = extractAliasMap(context);
        const tableCtx = /([A-Za-z0-9_"]+)\s*\.\s*([A-Za-z0-9_"]*)$/i.exec(
          context,
        );

        if (tableCtx) {
          const left = stripQuotes(tableCtx[1]);
          const right = stripQuotes(tableCtx[2]);

          // Alias -> column completion
          const aliasKey = Object.keys(aliasMap).find(
            (k) => k.toLowerCase() === left.toLowerCase(),
          );
          if (aliasKey && aliasMap[aliasKey]) {
            const resolved = await resolveTableRef(
              projectId,
              aliasMap[aliasKey],
            );
            if (resolved) {
              const cols = await ensureColumns(
                projectId,
                resolved.schema,
                resolved.table,
              );
              cols.forEach((c) =>
                add(
                  c,
                  monaco.languages.CompletionItemKind.Property,
                  `"${c}"`,
                  false,
                  `${resolved.table}.${c}`,
                ),
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
                ti.size,
              );
            }
            return { suggestions };
          }

          // schema.table. -> column completion
          const cols = await ensureColumns(projectId, left, right);
          cols.forEach((c) =>
            add(
              c,
              monaco.languages.CompletionItemKind.Property,
              `"${c}"`,
              false,
              `${right}.${c}`,
            ),
          );
          return { suggestions };
        }

        // FROM/JOIN context -> table completion
        const fromCtx = /(from|join)\s+([A-Za-z0-9_".]*)$/i.exec(context);
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
                ti.size,
              );
            }
          }
          return { suggestions };
        }

        // Schema names
        const projSchemas = state.schemas[projectId] || [];
        projSchemas.forEach((s) =>
          add(
            s,
            monaco.languages.CompletionItemKind.Module,
            `"${s}"`,
            false,
            "schema",
          ),
        );
      }

      for (const kw of SQL_KEYWORDS) {
        add(kw, monaco.languages.CompletionItemKind.Keyword, kw);
      }

      for (const snip of SQL_SNIPPETS) {
        add(
          snip.label,
          monaco.languages.CompletionItemKind.Snippet,
          snip.insert,
          true,
          snip.detail,
        );
      }

      return { suggestions };
    },
  });
}

const SQL_KEYWORDS = [
  "SELECT",
  "FROM",
  "WHERE",
  "AND",
  "OR",
  "NOT",
  "IN",
  "EXISTS",
  "INSERT",
  "INTO",
  "VALUES",
  "UPDATE",
  "SET",
  "DELETE",
  "CREATE",
  "ALTER",
  "DROP",
  "TABLE",
  "INDEX",
  "VIEW",
  "JOIN",
  "INNER",
  "LEFT",
  "RIGHT",
  "FULL",
  "OUTER",
  "CROSS",
  "ON",
  "GROUP",
  "BY",
  "ORDER",
  "ASC",
  "DESC",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "DISTINCT",
  "AS",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  "UNION",
  "ALL",
  "INTERSECT",
  "EXCEPT",
  "NULL",
  "IS",
  "BETWEEN",
  "LIKE",
  "ILIKE",
  "TRUE",
  "FALSE",
  "DEFAULT",
  "BEGIN",
  "COMMIT",
  "ROLLBACK",
  "SAVEPOINT",
  "PRIMARY",
  "KEY",
  "FOREIGN",
  "REFERENCES",
  "UNIQUE",
  "CHECK",
  "CONSTRAINT",
  "NOT NULL",
  "SERIAL",
  "BIGSERIAL",
  "TEXT",
  "INTEGER",
  "BIGINT",
  "SMALLINT",
  "BOOLEAN",
  "NUMERIC",
  "DECIMAL",
  "TIMESTAMP",
  "TIMESTAMPTZ",
  "DATE",
  "TIME",
  "INTERVAL",
  "UUID",
  "JSONB",
  "JSON",
  "VARCHAR",
  "CHAR",
  "BYTEA",
  "FLOAT",
  "DOUBLE PRECISION",
  "REAL",
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
  "COALESCE",
  "NULLIF",
  "ARRAY_AGG",
  "STRING_AGG",
  "ROW_NUMBER",
  "RANK",
  "DENSE_RANK",
  "OVER",
  "PARTITION",
  "WINDOW",
  "WITH",
  "RECURSIVE",
  "EXPLAIN",
  "ANALYZE",
  "VERBOSE",
  "GRANT",
  "REVOKE",
  "TRUNCATE",
  "RETURNING",
  "ON CONFLICT",
  "DO NOTHING",
  "DO UPDATE",
  "LATERAL",
  "FETCH",
  "FIRST",
  "NEXT",
  "ROWS",
  "ONLY",
];

const SQL_SNIPPETS = [
  {
    label: "sel",
    detail: "SELECT ... FROM ... WHERE",
    insert:
      "SELECT ${1:*}\nFROM ${2:table_name}\nWHERE ${3:condition}\nLIMIT ${4:100};",
  },
  {
    label: "selc",
    detail: "SELECT COUNT(*)",
    insert: "SELECT COUNT(*)\nFROM ${1:table_name}\nWHERE ${2:1=1};",
  },
  {
    label: "seld",
    detail: "SELECT DISTINCT",
    insert: "SELECT DISTINCT ${1:column}\nFROM ${2:table_name};",
  },
  {
    label: "ins",
    detail: "INSERT INTO ... VALUES",
    insert: "INSERT INTO ${1:table_name} (${2:columns})\nVALUES (${3:values});",
  },
  {
    label: "upd",
    detail: "UPDATE ... SET ... WHERE",
    insert:
      "UPDATE ${1:table_name}\nSET ${2:column} = ${3:value}\nWHERE ${4:condition};",
  },
  {
    label: "del",
    detail: "DELETE FROM ... WHERE",
    insert: "DELETE FROM ${1:table_name}\nWHERE ${2:condition};",
  },
  {
    label: "crt",
    detail: "CREATE TABLE",
    insert:
      "CREATE TABLE ${1:table_name} (\n  ${2:id} SERIAL PRIMARY KEY,\n  ${3:column} ${4:TEXT} NOT NULL\n);",
  },
  {
    label: "alt",
    detail: "ALTER TABLE ADD COLUMN",
    insert:
      "ALTER TABLE ${1:table_name}\nADD COLUMN ${2:column_name} ${3:TEXT};",
  },
  {
    label: "idx",
    detail: "CREATE INDEX",
    insert: "CREATE INDEX ${1:idx_name}\nON ${2:table_name} (${3:column});",
  },
  {
    label: "jn",
    detail: "SELECT ... JOIN ... ON",
    insert:
      "SELECT ${1:*}\nFROM ${2:table1} t1\nJOIN ${3:table2} t2 ON t1.${4:id} = t2.${5:t1_id}\nWHERE ${6:1=1};",
  },
  {
    label: "lj",
    detail: "SELECT ... LEFT JOIN",
    insert:
      "SELECT ${1:*}\nFROM ${2:table1} t1\nLEFT JOIN ${3:table2} t2 ON t1.${4:id} = t2.${5:t1_id};",
  },
  {
    label: "grp",
    detail: "SELECT ... GROUP BY ... ORDER BY",
    insert:
      "SELECT ${1:column}, COUNT(*)\nFROM ${2:table_name}\nGROUP BY ${1:column}\nORDER BY COUNT(*) DESC;",
  },
  {
    label: "cte",
    detail: "WITH ... AS (...) SELECT",
    insert:
      "WITH ${1:cte_name} AS (\n  SELECT ${2:*}\n  FROM ${3:table_name}\n  WHERE ${4:condition}\n)\nSELECT * FROM ${1:cte_name};",
  },
  {
    label: "exist",
    detail: "SELECT ... WHERE EXISTS",
    insert:
      "SELECT *\nFROM ${1:table_name} t1\nWHERE EXISTS (\n  SELECT 1\n  FROM ${2:other_table} t2\n  WHERE t2.${3:fk} = t1.${4:id}\n);",
  },
  {
    label: "upsert",
    detail: "INSERT ... ON CONFLICT DO UPDATE",
    insert:
      "INSERT INTO ${1:table_name} (${2:columns})\nVALUES (${3:values})\nON CONFLICT (${4:constraint})\nDO UPDATE SET ${5:column} = EXCLUDED.${5:column};",
  },
  {
    label: "vw",
    detail: "CREATE VIEW",
    insert:
      "CREATE OR REPLACE VIEW ${1:view_name} AS\nSELECT ${2:*}\nFROM ${3:table_name}\nWHERE ${4:condition};",
  },
  {
    label: "fn",
    detail: "CREATE FUNCTION",
    insert:
      "CREATE OR REPLACE FUNCTION ${1:func_name}(${2:params})\nRETURNS ${3:return_type}\nLANGUAGE plpgsql\nAS \\$\\$\nBEGIN\n  ${4:-- body}\nEND;\n\\$\\$;",
  },
  {
    label: "trg",
    detail: "CREATE TRIGGER",
    insert:
      "CREATE TRIGGER ${1:trigger_name}\n${2:BEFORE} ${3:INSERT} ON ${4:table_name}\nFOR EACH ROW\nEXECUTE FUNCTION ${5:func_name}();",
  },
  {
    label: "txn",
    detail: "BEGIN ... COMMIT",
    insert: "BEGIN;\n  ${1:-- statements}\nCOMMIT;",
  },
];
