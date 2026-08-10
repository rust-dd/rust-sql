import { describe, expect, it, vi } from "vitest";
import { neededSchema, withTimeout } from "./pending";
import type { CaretExpectation, ExpectedKind, RelationRef } from "./types";

const RANGE = { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 };
const SCHEMAS = ["public", "billing"];

function expectation(kinds: ExpectedKind[], qualifier: string[] = []): CaretExpectation {
  return { kinds, qualifier, range: RANGE };
}

describe("neededSchema", () => {
  it("needs the default schema where a relation is expected", () => {
    expect(neededSchema(expectation(["table"]), [], SCHEMAS, "public")).toBe("public");
  });

  it("needs the default schema where a column is expected", () => {
    expect(neededSchema(expectation(["column"]), [], SCHEMAS, "public")).toBe("public");
  });

  it("needs the named schema when the qualifier is one", () => {
    expect(neededSchema(expectation(["table"], ["billing"]), [], SCHEMAS, "public")).toBe(
      "billing",
    );
  });

  it("matches a schema qualifier regardless of case", () => {
    expect(neededSchema(expectation(["table"], ["BILLING"]), [], SCHEMAS, "public")).toBe(
      "billing",
    );
  });

  it("follows an alias to the schema its relation named", () => {
    const scope: RelationRef[] = [{ schema: "billing", name: "invoices", alias: "i" }];
    expect(neededSchema(expectation(["column"], ["i"]), scope, SCHEMAS, "public")).toBe("billing");
  });

  it("falls back to the default schema for an alias without one", () => {
    const scope: RelationRef[] = [{ name: "users", alias: "u" }];
    expect(neededSchema(expectation(["column"], ["u"]), scope, SCHEMAS, "public")).toBe("public");
  });

  it("needs nothing where only keywords can appear", () => {
    expect(neededSchema(expectation([]), [], SCHEMAS, "public")).toBeUndefined();
  });
});

describe("withTimeout", () => {
  it("resolves as soon as the work does", async () => {
    await expect(withTimeout(Promise.resolve(), 50)).resolves.toBeUndefined();
  });

  it("resolves rather than rejecting when the work fails", async () => {
    await expect(withTimeout(Promise.reject(new Error("nope")), 50)).resolves.toBeUndefined();
  });

  it("gives up once the deadline passes", async () => {
    vi.useFakeTimers();
    let settled = false;
    const promise = withTimeout(new Promise(() => {}), 100).then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(99);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    await promise;
    expect(settled).toBe(true);
    vi.useRealTimers();
  });
});
