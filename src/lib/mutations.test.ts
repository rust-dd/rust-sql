import { describe, expect, it } from "vitest";
import {
  buildMutations,
  countPending,
  type EditSession,
  emptySession,
  parsePkKey,
  pkKey,
  rowKeys,
} from "./mutations";
import type { CellValue } from "./wire";

const COLUMNS = ["id", "name", "note"];

function session(over: Partial<EditSession> = {}): EditSession {
  return { ...emptySession("public", "users", ["id"]), ...over };
}

describe("pkKey", () => {
  it("identifies a row by its key values, not its position", () => {
    const first = pkKey(COLUMNS, ["7", "ada", null], ["id"]);
    const second = pkKey(COLUMNS, ["7", "grace", "x"], ["id"]);
    expect(first).toBe(second);
  });

  it("keeps NULL apart from the text null and from the empty string", () => {
    const asNull = pkKey(COLUMNS, [null, "a", "b"], ["id"]);
    const asText = pkKey(COLUMNS, ["null", "a", "b"], ["id"]);
    const asEmpty = pkKey(COLUMNS, ["", "a", "b"], ["id"]);
    expect(new Set([asNull, asText, asEmpty]).size).toBe(3);
  });

  it("supports composite keys and is order-stable", () => {
    const key = pkKey(COLUMNS, ["7", "ada", "x"], ["id", "name"]);
    expect(parsePkKey(key as string)).toEqual([
      ["id", "7"],
      ["name", "ada"],
    ]);
  });

  it("returns null when a key column is missing from the result", () => {
    expect(pkKey(COLUMNS, ["7", "ada", "x"], ["tenant"])).toBeNull();
  });

  it("returns null for a short row rather than inventing a value", () => {
    expect(pkKey(COLUMNS, ["7"], ["id", "name"])).toBeNull();
  });

  it("returns null for a missing row", () => {
    expect(pkKey(COLUMNS, undefined, ["id"])).toBeNull();
  });

  it("returns null when there are no key columns", () => {
    expect(pkKey(COLUMNS, ["7", "ada", "x"], [])).toBeNull();
  });
});

describe("rowKeys", () => {
  it("maps every row to an identity, marking unidentifiable rows null", () => {
    const rows: CellValue[][] = [["1", "a", null], ["2", "b", "c"], ["3"]];
    expect(rowKeys(COLUMNS, rows, ["id", "name"])).toEqual([
      JSON.stringify([
        ["id", "1"],
        ["name", "a"],
      ]),
      JSON.stringify([
        ["id", "2"],
        ["name", "b"],
      ]),
      null,
    ]);
  });
});

describe("buildMutations", () => {
  const keyOne = JSON.stringify([["id", "1"]]);
  const keyTwo = JSON.stringify([["id", "2"]]);

  it("sends updates and deletes together in one payload", () => {
    const result = buildMutations(
      session({ edits: { [keyOne]: { name: "ada" } }, deletes: [keyTwo] }),
    );
    expect(result).toEqual([
      { kind: "update", set: [["name", "ada"]], pk: [["id", "1"]] },
      { kind: "delete", set: [], pk: [["id", "2"]] },
    ]);
  });

  it("drops edits on a row that is also marked for deletion", () => {
    const result = buildMutations(
      session({ edits: { [keyOne]: { name: "ada" } }, deletes: [keyOne] }),
    );
    expect(result).toEqual([{ kind: "delete", set: [], pk: [["id", "1"]] }]);
  });

  it("carries a NULL assignment through as null", () => {
    const result = buildMutations(session({ edits: { [keyOne]: { note: null } } }));
    expect(result[0].set).toEqual([["note", null]]);
  });

  it("skips rows whose edits were all reverted", () => {
    expect(buildMutations(session({ edits: { [keyOne]: {} } }))).toEqual([]);
  });

  it("produces nothing for an untouched session", () => {
    expect(buildMutations(session())).toEqual([]);
  });

  it("round-trips composite keys into the payload", () => {
    const composite = JSON.stringify([
      ["id", "1"],
      ["tenant", null],
    ]);
    const result = buildMutations(session({ deletes: [composite] }));
    expect(result[0].pk).toEqual([
      ["id", "1"],
      ["tenant", null],
    ]);
  });
});

describe("countPending", () => {
  const keyOne = JSON.stringify([["id", "1"]]);
  const keyTwo = JSON.stringify([["id", "2"]]);

  it("counts updates and deletes separately", () => {
    const counts = countPending(session({ edits: { [keyOne]: { name: "a" } }, deletes: [keyTwo] }));
    expect(counts).toEqual({ updates: 1, deletes: 1 });
  });

  it("does not count an edit that is shadowed by a delete", () => {
    const counts = countPending(session({ edits: { [keyOne]: { name: "a" } }, deletes: [keyOne] }));
    expect(counts).toEqual({ updates: 0, deletes: 1 });
  });

  it("does not count a row whose edits were reverted", () => {
    expect(countPending(session({ edits: { [keyOne]: {} } }))).toEqual({
      updates: 0,
      deletes: 0,
    });
  });
});
