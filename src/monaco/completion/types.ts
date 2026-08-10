/** Shapes shared by the completion core, its adapter and the schema index. */

export type RelationKind = "table" | "view" | "materializedview";

export interface IndexedColumn {
  name: string;
  data_type: string;
  nullable: boolean;
  default_value: string | null;
  is_primary_key: boolean;
  references: [string, string, string] | null;
}

export interface IndexedRelation {
  name: string;
  kind: RelationKind;
  comment: string | null;
  columns: IndexedColumn[];
}

export interface IndexedFunction {
  name: string;
  signature: string;
  return_type: string;
}

export interface SchemaIndex {
  schema: string;
  relations: IndexedRelation[];
  functions: IndexedFunction[];
  truncated: boolean;
}

/** A relation the statement refers to, as the parser reported it. */
export interface RelationRef {
  schema?: string;
  name: string;
  alias?: string;
}

/** What the grammar allows at the caret. */
export type ExpectedKind = "table" | "view" | "column" | "function" | "database";

export interface CaretExpectation {
  kinds: ExpectedKind[];
  /** Qualifier chain typed before the caret: `u.` gives `["u"]`. */
  qualifier: string[];
  range: CompletionRange;
}

export interface CompletionRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

/**
 * Read-only view over the loaded index. An interface rather than the store so
 * the completion core stays pure and can be tested with a literal fake.
 */
export interface Catalog {
  defaultSchema: string;
  schemas(): string[];
  relations(schema?: string): IndexedRelation[];
  relation(name: string, schema?: string): IndexedRelation | undefined;
  functions(schema?: string): IndexedFunction[];
}

export interface SnippetDef {
  label: string;
  insert: string;
  detail?: string;
}

export type ItemKind = "column" | "relation" | "function" | "schema" | "keyword" | "snippet";

export interface CompletionItem {
  label: string;
  kind: ItemKind;
  insertText: string;
  isSnippet: boolean;
  filterText: string;
  sortText: string;
  detail?: string;
  documentation?: string;
  range: CompletionRange;
}

export interface CompletionInput {
  expectation: CaretExpectation;
  keywords: string[];
  /** Relations in scope at the caret, with their aliases. */
  scope: RelationRef[];
  catalog: Catalog;
  snippets: SnippetDef[];
}
