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
import { catalogFor, useSchemaIndexStore } from "@/stores/schema-index-store";
import { useTabStore } from "@/stores/tab-store";
import { buildCompletions } from "./build";
import { neededSchema, withTimeout } from "./pending";
import { readExpectation, readScope, toMonacoItem } from "./service";
import { SQL_SNIPPETS } from "./snippets";
import type { Catalog, CompletionRange } from "./types";

/** Beyond this the parse stops being cheap enough to run per request. */
const MAX_PARSED_CHARS = 200_000;

/**
 * How long a request will wait for a schema snapshot it has never seen.
 *
 * Only the first request against a schema waits at all; the rest read memory.
 * Waiting is what makes Monaco show its own "Loading..." in the widget, which
 * is the difference between "the schema is still coming" and "there are no
 * tables here". Past this the request answers with whatever it has.
 */
const INDEX_WAIT_MS = 3_000;

/**
 * What can begin a statement.
 *
 * The parser answers with 62 statement-initial keywords as soon as there is one
 * character to anchor on, but returns nothing at all for a wholly empty
 * document — which is exactly where someone starts typing SELECT. This covers
 * that one case; every other position is answered by the grammar.
 */
const STATEMENT_START_KEYWORDS = [
  "SELECT",
  "WITH",
  "INSERT",
  "UPDATE",
  "DELETE",
  "CREATE",
  "ALTER",
  "DROP",
  "TRUNCATE",
  "EXPLAIN",
  "ANALYZE",
  "VACUUM",
  "GRANT",
  "REVOKE",
  "COMMENT",
  "REFRESH",
  "BEGIN",
  "COMMIT",
  "ROLLBACK",
  "SET",
  "SHOW",
  "CALL",
  "COPY",
  "VALUES",
];

/** Reused: constructing a parser rebuilds ANTLR state for nothing. */
let parser: PostgreSQL | null = null;

function getParser(): PostgreSQL {
  parser ??= new PostgreSQL();
  return parser;
}

const EMPTY_CATALOG: Catalog = {
  defaultSchema: "public",
  schemas: () => [],
  relations: () => [],
  relation: () => undefined,
  functions: () => [],
};

/**
 * Snippets and a small keyword set, for when parsing or the catalog fails.
 *
 * Monaco swallows a provider exception and shows an empty widget, which reads
 * as "completion is broken" with nothing to go on. Degrading to something
 * useful, and saying so on the console, beats silence.
 */
function fallbackItems(monaco: typeof Monaco, range: CompletionRange) {
  return buildCompletions({
    expectation: { kinds: [], qualifier: [], range },
    keywords: STATEMENT_START_KEYWORDS,
    scope: [],
    catalog: EMPTY_CATALOG,
    snippets: SQL_SNIPPETS,
  }).map((item) => toMonacoItem(monaco, item));
}

/**
 * The live registration. Registering is idempotent because the module is
 * re-executed on hot reload, and without this every save added another provider
 * and every suggestion appeared once more. Disposing rather than refusing means
 * a reload replaces the provider instead of leaving the stale one in charge.
 */
let registration: Monaco.IDisposable | null = null;

export function registerCompletion(monaco: typeof Monaco): Monaco.IDisposable {
  registration?.dispose();
  registration = monaco.languages.registerCompletionItemProvider("pgsql", {
    triggerCharacters: ["."],
    provideCompletionItems: async (model, position, _context, token) => {
      // The span the editor considers to be the word under the caret. Used
      // whenever the parser reports no range of its own.
      const typed = model.getWordUntilPosition(position);
      const wordRange: CompletionRange = {
        startLineNumber: position.lineNumber,
        startColumn: typed.startColumn,
        endLineNumber: position.lineNumber,
        endColumn: typed.endColumn,
      };

      try {
        const sql = model.getValue();
        if (sql.length > MAX_PARSED_CHARS) return { suggestions: [] };

        const caret = { lineNumber: position.lineNumber, column: position.column };
        const sqlParser = getParser();
        const suggestion = sqlParser.getSuggestionAtCaretPosition(sql, caret);
        if (token.isCancellationRequested) return { suggestions: [] };
        // An empty document parses to nothing, so the grammar cannot say what
        // may start a statement. Answer that one case ourselves.
        if (!suggestion) return { suggestions: fallbackItems(monaco, wordRange) };

        const entities = sqlParser.getAllEntities(sql, caret);
        if (token.isCancellationRequested) return { suggestions: [] };

        const { tabs, selectedTabIndex } = useTabStore.getState();
        const projectId = tabs[selectedTabIndex]?.projectId;

        const schemas = projectId ? (useProjectStore.getState().schemas[projectId] ?? []) : [];
        const defaultSchema = schemas.includes("public") ? "public" : (schemas[0] ?? "public");

        const expectation = readExpectation(suggestion.syntax as never, caret, wordRange);
        const scope = projectId ? readScope(entities as never) : [];

        let pending = false;
        if (projectId) {
          const wanted = neededSchema(expectation, scope, schemas, defaultSchema);
          const store = useSchemaIndexStore.getState();
          // Only wait when a snapshot is actually coming. After a failure the
          // fetch still retries in the background, but waiting on every
          // keystroke would just stall the editor for nothing.
          if (wanted && store.isWorthWaitingFor(projectId, wanted)) {
            await withTimeout(store.ensureIndex(projectId, wanted), INDEX_WAIT_MS);
            if (token.isCancellationRequested) return { suggestions: [] };
            pending = useSchemaIndexStore.getState().isPending(projectId, wanted);
          } else if (wanted && store.isPending(projectId, wanted)) {
            void store.ensureIndex(projectId, wanted);
            pending = true;
          }
        }

        const items = buildCompletions({
          expectation,
          keywords: suggestion.keywords ?? [],
          // Without a connected project there is no catalog, but the grammar's
          // keywords and the snippets are still worth offering.
          scope,
          catalog: projectId ? catalogFor(projectId, defaultSchema) : EMPTY_CATALOG,
          snippets: SQL_SNIPPETS,
        });

        return {
          suggestions: items.map((item) => toMonacoItem(monaco, item)),
          // Still waiting on the catalog: ask again on the next keystroke
          // instead of filtering this partial list forever.
          incomplete: pending,
        };
      } catch (error) {
        console.error("[rsql] SQL completion failed", error);
        return { suggestions: fallbackItems(monaco, wordRange) };
      }
    },
  });

  return registration;
}
