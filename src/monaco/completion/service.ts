/**
 * Adapter between monaco-sql-languages' completion callback and the pure core.
 *
 * Everything here is plumbing: read what the parser found, gather the catalog
 * slices it refers to, call `buildCompletions`, map the result to Monaco's
 * shape. The decisions live in `build.ts` so they can be tested without Monaco.
 */

import type * as Monaco from "monaco-editor";
import { useProjectStore } from "@/stores/project-store";
import { catalogFor } from "@/stores/schema-index-store";
import { useTabStore } from "@/stores/tab-store";
import { buildCompletions } from "./build";
import { SQL_SNIPPETS } from "./snippets";
import type {
  CaretExpectation,
  CompletionItem,
  CompletionRange,
  ExpectedKind,
  ItemKind,
  RelationRef,
} from "./types";

/** `syntaxContextType` values we know how to answer. */
const EXPECTED: Record<string, ExpectedKind> = {
  table: "table",
  view: "view",
  column: "column",
  function: "function",
  database: "database",
};

interface WordRange {
  text: string;
  startColumn: number;
  endColumn: number;
  line: number;
}

interface SyntaxSuggestion {
  syntaxContextType: string;
  wordRanges: WordRange[];
}

/**
 * The parser reports the words already typed before the caret. A trailing dot
 * means everything before it is a qualifier, and the range to replace is the
 * empty span after the dot rather than the dot itself.
 */
export function readExpectation(
  syntax: SyntaxSuggestion[],
  position: { lineNumber: number; column: number },
): CaretExpectation {
  const kinds: ExpectedKind[] = [];
  for (const entry of syntax) {
    const kind = EXPECTED[entry.syntaxContextType];
    if (kind && !kinds.includes(kind)) kinds.push(kind);
  }

  const words = syntax[0]?.wordRanges ?? [];
  const qualifier: string[] = [];
  let range: CompletionRange = {
    startLineNumber: position.lineNumber,
    startColumn: position.column,
    endLineNumber: position.lineNumber,
    endColumn: position.column,
  };

  if (words.length > 0) {
    const last = words[words.length - 1];
    if (last.text === ".") {
      for (const word of words.slice(0, -1)) {
        if (word.text !== ".") qualifier.push(word.text.replace(/"/g, ""));
      }
    } else {
      // A partially typed word: replace exactly what the parser measured.
      range = {
        startLineNumber: last.line,
        startColumn: last.startColumn,
        endLineNumber: last.line,
        endColumn: last.endColumn,
      };
      for (const word of words.slice(0, -1)) {
        if (word.text !== ".") qualifier.push(word.text.replace(/"/g, ""));
      }
    }
  }

  return { kinds, qualifier, range };
}

/** Table entities the parser collected, with the aliases it resolved. */
export function readScope(entities: any[] | null): RelationRef[] {
  if (!entities) return [];
  const refs: RelationRef[] = [];
  for (const entity of entities) {
    if (entity?.entityContextType !== "table" && entity?.entityContextType !== "view") continue;
    const text: string = entity.text ?? "";
    if (!text) continue;
    const parts = text.split(".").map((p: string) => p.replace(/"/g, ""));
    const name = parts[parts.length - 1];
    const schema = parts.length > 1 ? parts[parts.length - 2] : undefined;
    refs.push({ schema, name, alias: entity._alias?.text ?? undefined });
  }
  return refs;
}

const KIND_MAP: Record<ItemKind, keyof typeof Monaco.languages.CompletionItemKind> = {
  column: "Field",
  relation: "Class",
  function: "Function",
  schema: "Module",
  keyword: "Keyword",
  snippet: "Snippet",
};

function toMonaco(monaco: typeof Monaco, item: CompletionItem) {
  return {
    label: item.label,
    kind: monaco.languages.CompletionItemKind[KIND_MAP[item.kind]],
    insertText: item.insertText,
    insertTextRules: item.isSnippet
      ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
      : undefined,
    filterText: item.filterText,
    sortText: item.sortText,
    detail: item.detail,
    documentation: item.documentation,
    range: item.range,
  };
}

export function createCompletionService(monaco: typeof Monaco) {
  return async (
    _model: unknown,
    position: { lineNumber: number; column: number },
    _context: unknown,
    suggestions: { syntax: SyntaxSuggestion[]; keywords: string[] } | null,
    entities: any[] | null,
  ) => {
    if (!suggestions) return [];

    const { tabs, selectedTabIndex } = useTabStore.getState();
    const projectId = tabs[selectedTabIndex]?.projectId;
    if (!projectId) return [];

    const projectSchemas = useProjectStore.getState().schemas[projectId] ?? [];
    const defaultSchema = projectSchemas.includes("public")
      ? "public"
      : (projectSchemas[0] ?? "public");

    const items = buildCompletions({
      expectation: readExpectation(suggestions.syntax, position),
      keywords: suggestions.keywords ?? [],
      scope: readScope(entities),
      catalog: catalogFor(projectId, defaultSchema),
      snippets: SQL_SNIPPETS,
    });

    return items.map((item) => toMonaco(monaco, item));
  };
}
