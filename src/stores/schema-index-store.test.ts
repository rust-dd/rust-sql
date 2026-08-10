import { beforeEach, describe, expect, it, vi } from "vitest";

const loadSchemaIndex = vi.fn();

vi.mock("@/lib/database-driver", () => ({
  DriverFactory: { getDriver: () => ({ loadSchemaIndex }) },
}));

vi.mock("@/stores/project-store", () => ({
  useProjectStore: {
    getState: () => ({ projects: { p1: { driver: "PGSQL" } }, schemas: { p1: ["public"] } }),
  },
}));

const { useSchemaIndexStore } = await import("./schema-index-store");

function emptyIndex(schema: string) {
  return { schema, relations: [], functions: [], truncated: false };
}

/** A load whose completion the test controls. */
function deferred() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  loadSchemaIndex.mockReset();
  useSchemaIndexStore.setState({ indexes: {}, loading: {}, stale: {}, failed: {} });
});

describe("ensureIndex", () => {
  it("fetches a schema it has never seen", async () => {
    loadSchemaIndex.mockResolvedValue(emptyIndex("public"));
    await useSchemaIndexStore.getState().ensureIndex("p1", "public");
    expect(loadSchemaIndex).toHaveBeenCalledTimes(1);
    expect(useSchemaIndexStore.getState().getIndex("p1", "public")).toBeDefined();
  });

  it("does not fetch a schema it already has", async () => {
    loadSchemaIndex.mockResolvedValue(emptyIndex("public"));
    await useSchemaIndexStore.getState().ensureIndex("p1", "public");
    await useSchemaIndexStore.getState().ensureIndex("p1", "public");
    expect(loadSchemaIndex).toHaveBeenCalledTimes(1);
  });

  it("waits for a load already in flight instead of returning at once", async () => {
    // This is what broke the editor's loading state: a second caller resolved
    // immediately while the first fetch was still running, so it neither waited
    // nor found an index.
    const gate = deferred();
    loadSchemaIndex.mockReturnValue(gate.promise);

    const first = useSchemaIndexStore.getState().ensureIndex("p1", "public");
    let secondSettled = false;
    const second = useSchemaIndexStore
      .getState()
      .ensureIndex("p1", "public")
      .then(() => {
        secondSettled = true;
      });

    await Promise.resolve();
    expect(secondSettled).toBe(false);

    gate.resolve(emptyIndex("public"));
    await Promise.all([first, second]);
    expect(secondSettled).toBe(true);
    expect(loadSchemaIndex).toHaveBeenCalledTimes(1);
  });

  it("reports pending until the fetch lands", async () => {
    const gate = deferred();
    loadSchemaIndex.mockReturnValue(gate.promise);

    expect(useSchemaIndexStore.getState().isPending("p1", "public")).toBe(true);
    const load = useSchemaIndexStore.getState().ensureIndex("p1", "public");
    expect(useSchemaIndexStore.getState().isPending("p1", "public")).toBe(true);

    gate.resolve(emptyIndex("public"));
    await load;
    expect(useSchemaIndexStore.getState().isPending("p1", "public")).toBe(false);
  });

  it("retries after a failure rather than staying stuck", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    loadSchemaIndex.mockRejectedValueOnce(new Error("nope"));
    await useSchemaIndexStore.getState().ensureIndex("p1", "public");
    expect(useSchemaIndexStore.getState().isPending("p1", "public")).toBe(true);
    expect(spy).toHaveBeenCalled();

    loadSchemaIndex.mockResolvedValue(emptyIndex("public"));
    await useSchemaIndexStore.getState().ensureIndex("p1", "public");
    expect(useSchemaIndexStore.getState().isPending("p1", "public")).toBe(false);
    expect(loadSchemaIndex).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it("stops being worth waiting for once a fetch has failed", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    loadSchemaIndex.mockRejectedValue(new Error("nope"));
    await useSchemaIndexStore.getState().ensureIndex("p1", "public");

    // Still retried in the background, but no request should stall on it.
    expect(useSchemaIndexStore.getState().isPending("p1", "public")).toBe(true);
    expect(useSchemaIndexStore.getState().isWorthWaitingFor("p1", "public")).toBe(false);
    spy.mockRestore();
  });

  it("is worth waiting for again after a fetch succeeds", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    loadSchemaIndex.mockRejectedValueOnce(new Error("nope"));
    await useSchemaIndexStore.getState().ensureIndex("p1", "public");
    expect(useSchemaIndexStore.getState().isWorthWaitingFor("p1", "public")).toBe(false);

    loadSchemaIndex.mockResolvedValue(emptyIndex("public"));
    await useSchemaIndexStore.getState().ensureIndex("p1", "public");
    useSchemaIndexStore.getState().invalidateProject("p1");
    expect(useSchemaIndexStore.getState().isWorthWaitingFor("p1", "public")).toBe(true);
    spy.mockRestore();
  });

  it("refetches a schema invalidated by DDL", async () => {
    loadSchemaIndex.mockResolvedValue(emptyIndex("public"));
    await useSchemaIndexStore.getState().ensureIndex("p1", "public");

    useSchemaIndexStore.getState().invalidateProject("p1");
    expect(useSchemaIndexStore.getState().isPending("p1", "public")).toBe(true);

    await useSchemaIndexStore.getState().ensureIndex("p1", "public");
    expect(loadSchemaIndex).toHaveBeenCalledTimes(2);
    expect(useSchemaIndexStore.getState().isPending("p1", "public")).toBe(false);
  });
});
