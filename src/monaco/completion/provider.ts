/**
 * Registers SQL completion directly on the editor's own Monaco instance.
 *
 * The library can supply completions through its worker, but that path depends
 * on a lazy `onLanguage` registration, a worker resolving under the right label,
 * and the library and the app agreeing on one Monaco instance. Parsing here
 * instead removes all three: the code path that runs is the one
 * `pipeline.test.ts` exercises. A statement of a few hundred characters parses
 * in about 2ms, which is affordable for a user-triggered request.
 */

import { PostgreSQL } from "dt-sql-parser";
import type * as Monaco from "monaco-editor";
import { useProjectStore } from "@/stores/project-store";
import { catalogFor } from "@/stores/schema-index-store";
import { useTabStore } from "@/stores/tab-store";
import { buildCompletions } from "./build";
import { readExpectation, readScope, toMonacoItem } from "./service";
import { SQL_SNIPPETS } from "./snippets";

/** Beyond this the parse stops being cheap enough to run per request. */
const MAX_PARSED_CHARS = 200_000;

/** Reused: constructing a parser rebuilds ANTLR state for nothing. */
let parser: PostgreSQL | null = null;

function getParser(): PostgreSQL {
  parser ??= new PostgreSQL();
  return parser;
}

export function registerCompletion(monaco: typeof Monaco): Monaco.IDisposable {
  return monaco.languages.registerCompletionItemProvider("pgsql", {
    triggerCharacters: ["."],
    provideCompletionItems: (model, position, _context, token) => {
      const sql = model.getValue();
      if (sql.length > MAX_PARSED_CHARS) return { suggestions: [] };

      const caret = { lineNumber: position.lineNumber, column: position.column };
      const sqlParser = getParser();
      const suggestion = sqlParser.getSuggestionAtCaretPosition(sql, caret);
      if (!suggestion || token.isCancellationRequested) return { suggestions: [] };

      const entities = sqlParser.getAllEntities(sql, caret);
      if (token.isCancellationRequested) return { suggestions: [] };

      const { tabs, selectedTabIndex } = useTabStore.getState();
      const projectId = tabs[selectedTabIndex]?.projectId;

      const schemas = projectId ? (useProjectStore.getState().schemas[projectId] ?? []) : [];
      const defaultSchema = schemas.includes("public") ? "public" : (schemas[0] ?? "public");

      const items = buildCompletions({
        expectation: readExpectation(suggestion.syntax as never, caret),
        keywords: suggestion.keywords ?? [],
        // Without a connected project there is no catalog, but the grammar's
        // keywords and the snippets are still worth offering.
        scope: projectId ? readScope(entities as never) : [],
        catalog: projectId
          ? catalogFor(projectId, defaultSchema)
          : {
              defaultSchema,
              schemas: () => [],
              relations: () => [],
              relation: () => undefined,
              functions: () => [],
            },
        snippets: SQL_SNIPPETS,
      });

      return { suggestions: items.map((item) => toMonacoItem(monaco, item)) };
    },
  });
}
