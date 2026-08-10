/**
 * Pins the parts of dt-sql-parser's behaviour that completion depends on.
 *
 * The completion service is built entirely on what the parser reports at the
 * caret rather than on regexes over the text. If an upgrade changes any of
 * these, completion silently degrades, so they are asserted rather than
 * assumed.
 */

import { PostgreSQL } from "dt-sql-parser";
import { describe, expect, it } from "vitest";

/** `|` marks the caret. */
function at(marked: string) {
  const offset = marked.indexOf("|");
  const sql = marked.replace("|", "");
  const before = sql.slice(0, offset);
  const lines = before.split("\n");
  const position = { lineNumber: lines.length, column: lines[lines.length - 1].length + 1 };
  const parser = new PostgreSQL();
  const suggestion = parser.getSuggestionAtCaretPosition(sql, position);
  return {
    syntax: suggestion?.syntax ?? [],
    keywords: suggestion?.keywords ?? [],
    entities: (parser.getAllEntities(sql, position) ?? []) as any[],
  };
}

function types(syntax: { syntaxContextType: string }[]): string[] {
  return syntax.map((s) => s.syntaxContextType);
}

describe("what the parser reports at the caret", () => {
  it("expects a relation after FROM", () => {
    expect(types(at("SELECT * FROM |").syntax)).toContain("table");
  });

  it("expects a column after an alias dot, and reports the qualifier", () => {
    const { syntax } = at("SELECT u.| FROM users u");
    const column = syntax.find((s) => s.syntaxContextType === "column");
    expect(column).toBeDefined();
    expect(column?.wordRanges.map((w) => w.text)).toEqual(["u", "."]);
  });

  it("expects a column in the select list", () => {
    expect(types(at("SELECT | FROM users u").syntax)).toContain("column");
  });

  it("reports the word range to replace, so completions do not guess it", () => {
    const { syntax } = at("SELECT * FROM us|");
    const table = syntax.find((s) => s.syntaxContextType === "table");
    expect(table?.wordRanges[0]).toMatchObject({ text: "us", startColumn: 15, endColumn: 17 });
  });

  it("narrows keywords to those valid at the caret", () => {
    // Far fewer than the full keyword list, which is the point of asking.
    expect(at("SELECT * FROM |").keywords.length).toBeLessThan(60);
  });

  it("collects table entities together with their aliases", () => {
    const { entities } = at("SELECT | FROM public.users u JOIN orders o ON o.user_id = u.id");
    const tables = entities.filter((e) => e.entityContextType === "table");
    expect(tables.map((e) => [e.text, e._alias?.text])).toEqual([
      ["public.users", "u"],
      ["orders", "o"],
    ]);
  });

  it("reports a CTE reference as a relation, so it must be resolved separately", () => {
    const { entities } = at("WITH recent AS (SELECT * FROM orders) SELECT | FROM recent r");
    const names = entities.filter((e) => e.entityContextType === "table").map((e) => e.text);
    expect(names).toContain("recent");
  });
});
