/**
 * Turns what the parser reports at the caret into completion items.
 *
 * Pure on purpose: no Monaco, no store, no I/O. Everything it needs arrives in
 * `CompletionInput`, so the behaviour that matters — which suggestions appear,
 * in what order, and what text they replace — is testable directly.
 */

import type {
  CompletionInput,
  CompletionItem,
  CompletionRange,
  IndexedColumn,
  IndexedRelation,
  ItemKind,
  RelationRef,
} from "./types";

/**
 * Rank groups. The parser reports 143 valid keywords in a select list, so
 * without an explicit order the columns you actually want are buried.
 */
const RANK: Record<ItemKind, string> = {
  column: "0",
  relation: "1",
  function: "2",
  schema: "3",
  keyword: "4",
  snippet: "5",
};

const PLAIN_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

/** Quote only what Postgres would not read back as the same identifier. */
export function quoteIfNeeded(name: string): string {
  if (PLAIN_IDENTIFIER.test(name)) return name;
  return `"${name.replace(/"/g, '""')}"`;
}

/** Short alias for a relation: `order_items` becomes `oi`, `users` becomes `u`. */
export function suggestAlias(name: string): string {
  const parts = name.split("_").filter(Boolean);
  if (parts.length === 0) return name.slice(0, 1) || "t";
  if (parts.length === 1) return parts[0].slice(0, 1);
  return parts.map((p) => p[0]).join("");
}

function item(
  kind: ItemKind,
  label: string,
  insertText: string,
  range: CompletionRange,
  extra: { detail?: string; documentation?: string; filterText?: string; isSnippet?: boolean } = {},
): CompletionItem {
  return {
    label,
    kind,
    insertText,
    isSnippet: extra.isSnippet ?? false,
    filterText: extra.filterText ?? label,
    sortText: `${RANK[kind]}${label.toLowerCase()}`,
    detail: extra.detail,
    documentation: extra.documentation,
    range,
  };
}

function columnDetail(column: IndexedColumn, relation: string): string {
  const parts = [column.data_type];
  if (column.is_primary_key) parts.push("PK");
  if (!column.nullable) parts.push("NOT NULL");
  if (column.references) {
    const [schema, table, target] = column.references;
    parts.push(`→ ${schema}.${table}.${target}`);
  }
  return `${relation} · ${parts.join(" · ")}`;
}

function columnItems(
  relation: IndexedRelation,
  range: CompletionRange,
  label: string,
): CompletionItem[] {
  return relation.columns.map((column) =>
    item("column", column.name, quoteIfNeeded(column.name), range, {
      detail: columnDetail(column, label),
    }),
  );
}

/**
 * Only ever the bare relation name, never schema-qualified: the replacement
 * range covers what is being typed after any qualifier, so a schema the user
 * already wrote is still in the buffer. Inserting it again produced
 * `noexapp.noexapp.agent_memory_preferences`.
 */
function relationItems(relations: IndexedRelation[], range: CompletionRange): CompletionItem[] {
  return relations.map((relation) => {
    const alias = suggestAlias(relation.name);
    return item(
      "relation",
      relation.name,
      `${quoteIfNeeded(relation.name)} \${1:${alias}}`,
      range,
      {
        detail: relation.kind === "table" ? "table" : relation.kind,
        documentation: relation.comment ?? undefined,
        isSnippet: true,
      },
    );
  });
}

function functionItems(input: CompletionInput, schema?: string): CompletionItem[] {
  const { range } = input.expectation;
  return input.catalog.functions(schema).map((fn) =>
    item("function", fn.name, `${quoteIfNeeded(fn.name)}($0)`, range, {
      detail: `(${fn.signature}) → ${fn.return_type}`,
      isSnippet: true,
    }),
  );
}

/** Find the relation a qualifier refers to: an alias first, then a bare name. */
function resolveQualifier(qualifier: string, scope: RelationRef[]): RelationRef | undefined {
  const lower = qualifier.toLowerCase();
  return (
    scope.find((ref) => ref.alias?.toLowerCase() === lower) ??
    scope.find((ref) => ref.name.toLowerCase() === lower)
  );
}

/**
 * Completions after a qualifier such as `u.` or `public.`.
 *
 * An unrecognised qualifier yields nothing rather than falling back to
 * everything: offering unrelated columns after a typo is worse than silence.
 */
function qualifiedCompletions(input: CompletionInput): CompletionItem[] {
  const { expectation, scope, catalog } = input;
  const qualifier = expectation.qualifier[expectation.qualifier.length - 1];
  const { range } = expectation;

  const ref = resolveQualifier(qualifier, scope);
  if (ref) {
    const relation = catalog.relation(ref.name, ref.schema);
    if (relation) return columnItems(relation, range, ref.alias ?? relation.name);
    // A CTE reads as a relation the catalog has never heard of. Its columns
    // are not in the index, so offer nothing rather than a same-named table's.
    return [];
  }

  const schemas = catalog.schemas();
  const schema = schemas.find((s) => s.toLowerCase() === qualifier.toLowerCase());
  if (schema) {
    return [...relationItems(catalog.relations(schema), range), ...functionItems(input, schema)];
  }

  return [];
}

function unqualifiedCompletions(input: CompletionInput): CompletionItem[] {
  const { expectation, scope, catalog } = input;
  const { range } = expectation;
  const kinds = new Set(expectation.kinds);
  const items: CompletionItem[] = [];

  if (kinds.has("column")) {
    for (const ref of scope) {
      const relation = catalog.relation(ref.name, ref.schema);
      if (relation) items.push(...columnItems(relation, range, ref.alias ?? relation.name));
    }
  }

  if (kinds.has("table") || kinds.has("view")) {
    items.push(...relationItems(catalog.relations(catalog.defaultSchema), range));
    for (const schema of catalog.schemas()) {
      if (schema === catalog.defaultSchema) continue;
      items.push(item("schema", schema, quoteIfNeeded(schema), range, { detail: "schema" }));
    }
  }

  if (kinds.has("database")) {
    for (const schema of catalog.schemas()) {
      items.push(item("schema", schema, quoteIfNeeded(schema), range, { detail: "schema" }));
    }
  }

  if (kinds.has("function")) items.push(...functionItems(input));

  return items;
}

export function buildCompletions(input: CompletionInput): CompletionItem[] {
  const { expectation, keywords, snippets } = input;
  const { range } = expectation;

  if (expectation.qualifier.length > 0) {
    // A qualifier is a definite statement about what is wanted; keywords and
    // snippets after `u.` would be noise.
    return qualifiedCompletions(input);
  }

  const items = unqualifiedCompletions(input);

  for (const keyword of keywords) {
    items.push(item("keyword", keyword, keyword, range));
  }

  for (const snippet of snippets) {
    items.push(
      item("snippet", snippet.label, snippet.insert, range, {
        detail: snippet.detail,
        isSnippet: true,
      }),
    );
  }

  return items;
}
