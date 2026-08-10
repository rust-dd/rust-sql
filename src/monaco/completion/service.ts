/**
 * Translation between the parser's output and the pure completion core, and
 * between the core's items and Monaco's shape.
 *
 * Kept separate from `provider.ts` so the reading functions can be tested
 * against real parser output without registering anything.
 */

import type * as Monaco from "monaco-editor";
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
 *
 * `wordRange` is the span the editor itself thinks is being typed, and is used
 * whenever the parser offers none. While the first word of a statement is being
 * typed the parser reports no syntax entries at all, and replacing an empty span
 * there would insert next to what the user typed instead of completing it —
 * `SEL` accepting `SELECT` would leave `SELSELECT`.
 */
export function readExpectation(
  syntax: SyntaxSuggestion[],
  position: { lineNumber: number; column: number },
  wordRange?: CompletionRange,
): CaretExpectation {
  const kinds: ExpectedKind[] = [];
  for (const entry of syntax) {
    const kind = EXPECTED[entry.syntaxContextType];
    if (kind && !kinds.includes(kind)) kinds.push(kind);
  }

  const words = syntax[0]?.wordRanges ?? [];
  const qualifier: string[] = [];
  let range: CompletionRange = wordRange ?? {
    startLineNumber: position.lineNumber,
    startColumn: position.column,
    endLineNumber: position.lineNumber,
    endColumn: position.column,
  };

  if (words.length > 0) {
    const last = words[words.length - 1];
    if (last.text === ".") {
      range = {
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      };
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

export function toMonacoItem(monaco: typeof Monaco, item: CompletionItem) {
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
