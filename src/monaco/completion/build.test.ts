import { describe, expect, it } from "vitest";
import { buildCompletions, quoteIfNeeded, suggestAlias } from "./build";
import type {
  Catalog,
  CompletionInput,
  CompletionRange,
  ExpectedKind,
  IndexedColumn,
  IndexedRelation,
  RelationRef,
} from "./types";

const RANGE: CompletionRange = {
  startLineNumber: 1,
  startColumn: 8,
  endLineNumber: 1,
  endColumn: 10,
};

function column(name: string, over: Partial<IndexedColumn> = {}): IndexedColumn {
  return {
    name,
    data_type: "text",
    nullable: true,
    default_value: null,
    is_primary_key: false,
    references: null,
    ...over,
  };
}

function relation(name: string, columns: IndexedColumn[]): IndexedRelation {
  return { name, kind: "table", comment: null, columns };
}

const USERS = relation("users", [
  column("id", { data_type: "bigint", nullable: false, is_primary_key: true }),
  column("email"),
]);
const ORDERS = relation("orders", [
  column("id", { data_type: "bigint", nullable: false, is_primary_key: true }),
  column("user_id", { data_type: "bigint", references: ["public", "users", "id"] }),
]);

function catalog(over: Partial<Catalog> = {}): Catalog {
  const bySchema: Record<string, IndexedRelation[]> = {
    public: [USERS, ORDERS],
    billing: [relation("invoices", [column("number")])],
  };
  return {
    defaultSchema: "public",
    schemas: () => Object.keys(bySchema),
    relations: (schema) => bySchema[schema ?? "public"] ?? [],
    relation: (name, schema) => (bySchema[schema ?? "public"] ?? []).find((r) => r.name === name),
    functions: (schema) =>
      schema === "billing"
        ? []
        : [{ name: "now", signature: "", return_type: "timestamp with time zone" }],
    ...over,
  };
}

function input(over: {
  kinds?: ExpectedKind[];
  qualifier?: string[];
  scope?: RelationRef[];
  keywords?: string[];
  catalog?: Catalog;
}): CompletionInput {
  return {
    expectation: {
      kinds: over.kinds ?? ["column"],
      qualifier: over.qualifier ?? [],
      range: RANGE,
    },
    keywords: over.keywords ?? [],
    scope: over.scope ?? [],
    catalog: over.catalog ?? catalog(),
    snippets: [],
  };
}

const labels = (items: { label: string }[]) => items.map((i) => i.label);

describe("qualified completions", () => {
  it("offers the columns of the relation an alias stands for", () => {
    const items = buildCompletions(
      input({ qualifier: ["u"], scope: [{ name: "users", alias: "u" }] }),
    );
    expect(labels(items)).toEqual(["id", "email"]);
  });

  it("resolves a bare relation name as well as an alias", () => {
    const items = buildCompletions(input({ qualifier: ["orders"], scope: [{ name: "orders" }] }));
    expect(labels(items)).toEqual(["id", "user_id"]);
  });

  it("offers a schema's relations when the qualifier is a schema", () => {
    const items = buildCompletions(input({ qualifier: ["billing"] }));
    expect(labels(items)).toContain("invoices");
  });

  it("does not repeat a schema the user already typed", () => {
    // `billing.` is already in the buffer, so inserting billing.invoices gave
    // billing.billing.invoices.
    const invoices = buildCompletions(input({ qualifier: ["billing"] })).find(
      (i) => i.label === "invoices",
    );
    expect(invoices?.insertText).toBe("invoices ${1:i}");
  });

  it("offers nothing for an unknown qualifier rather than guessing", () => {
    const items = buildCompletions(
      input({ qualifier: ["zzz"], scope: [{ name: "users", alias: "u" }] }),
    );
    expect(items).toEqual([]);
  });

  it("offers nothing for a CTE, whose columns the catalog cannot know", () => {
    const items = buildCompletions(
      input({ qualifier: ["r"], scope: [{ name: "recent", alias: "r" }] }),
    );
    expect(items).toEqual([]);
  });

  it("suppresses keywords and snippets after a qualifier", () => {
    const items = buildCompletions(
      input({
        qualifier: ["u"],
        scope: [{ name: "users", alias: "u" }],
        keywords: ["SELECT", "WHERE"],
      }),
    );
    expect(items.every((i) => i.kind === "column")).toBe(true);
  });

  it("uses the last qualifier of a chain", () => {
    const items = buildCompletions(input({ qualifier: ["public", "billing"] }));
    expect(labels(items)).toContain("invoices");
  });
});

describe("unqualified completions", () => {
  it("offers columns of every relation in scope", () => {
    const items = buildCompletions(
      input({
        scope: [
          { name: "users", alias: "u" },
          { name: "orders", alias: "o" },
        ],
      }),
    );
    expect(labels(items.filter((i) => i.kind === "column"))).toEqual([
      "id",
      "email",
      "id",
      "user_id",
    ]);
  });

  it("labels each column with the relation it came from", () => {
    const items = buildCompletions(input({ scope: [{ name: "users", alias: "u" }] }));
    expect(items[0].detail).toContain("u ·");
  });

  it("offers relations and other schemas where a table is expected", () => {
    const items = buildCompletions(input({ kinds: ["table"] }));
    expect(labels(items.filter((i) => i.kind === "relation"))).toEqual(["users", "orders"]);
    expect(labels(items.filter((i) => i.kind === "schema"))).toEqual(["billing"]);
  });

  it("offers no columns when the grammar does not expect one", () => {
    const items = buildCompletions(
      input({ kinds: ["table"], scope: [{ name: "users", alias: "u" }] }),
    );
    expect(items.some((i) => i.kind === "column")).toBe(false);
  });

  it("offers nothing from a relation whose columns were truncated", () => {
    const empty = catalog({
      relation: (name) => (name === "users" ? relation("users", []) : undefined),
    });
    const items = buildCompletions(input({ scope: [{ name: "users" }], catalog: empty }));
    expect(items).toEqual([]);
  });
});

describe("ordering and replacement", () => {
  it("sorts columns above keywords", () => {
    const items = buildCompletions(
      input({ scope: [{ name: "users", alias: "u" }], keywords: ["SELECT", "ALL"] }),
    );
    const sorted = [...items].sort((a, b) => a.sortText.localeCompare(b.sortText));
    expect(sorted[0].kind).toBe("column");
    expect(sorted[sorted.length - 1].kind).toBe("keyword");
  });

  it("gives every item the range the parser reported", () => {
    const items = buildCompletions(input({ kinds: ["table"], keywords: ["SELECT"] }));
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.range === RANGE)).toBe(true);
  });

  it("filters on the bare name rather than the qualified label", () => {
    const items = buildCompletions(input({ kinds: ["table"] }));
    const users = items.find((i) => i.label === "users");
    expect(users?.filterText).toBe("users");
    expect(users?.insertText).toContain("users");
  });

  it("inserts a relation with a generated alias placeholder", () => {
    const items = buildCompletions(input({ kinds: ["table"] }));
    expect(items.find((i) => i.label === "orders")?.insertText).toBe("orders ${1:o}");
  });
});

describe("column detail", () => {
  it("reports type, key and nullability", () => {
    const items = buildCompletions(
      input({ qualifier: ["u"], scope: [{ name: "users", alias: "u" }] }),
    );
    expect(items[0].detail).toBe("u · bigint · PK · NOT NULL");
  });

  it("reports a foreign-key target", () => {
    const items = buildCompletions(
      input({ qualifier: ["o"], scope: [{ name: "orders", alias: "o" }] }),
    );
    expect(items[1].detail).toContain("→ public.users.id");
  });
});

describe("identifier handling", () => {
  it("leaves plain lowercase identifiers unquoted", () => {
    expect(quoteIfNeeded("users")).toBe("users");
    expect(quoteIfNeeded("order_items")).toBe("order_items");
  });

  it("quotes anything Postgres would fold or reject", () => {
    expect(quoteIfNeeded("Users")).toBe('"Users"');
    expect(quoteIfNeeded("my table")).toBe('"my table"');
    expect(quoteIfNeeded('we"ird')).toBe('"we""ird"');
  });

  it("builds an alias from word initials", () => {
    expect(suggestAlias("users")).toBe("u");
    expect(suggestAlias("order_items")).toBe("oi");
    expect(suggestAlias("a_b_c")).toBe("abc");
  });
});
