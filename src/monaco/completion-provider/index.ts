import type * as Monaco from "monaco-editor";
import { useProjectStore } from "@/stores/project-store";
import { useTabStore } from "@/stores/tab-store";
import { extractAliasMap, genAlias, stripQuotes } from "./alias-parser";
import { ensureColumns, ensureTables, resolveTableRef } from "./resolver";
import { SQL_KEYWORDS } from "./keywords";
import { SQL_SNIPPETS } from "./snippets";

let registered = false;

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
