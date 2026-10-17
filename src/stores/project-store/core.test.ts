import { describe, expect, it } from "vitest";
import { buildProjectMap, projectName, toDetailArray } from "./core";

const row = (database: string, name: string, legacyId = "") => [
  "PGSQL",
  "app",
  "secret",
  database,
  "db.local",
  "5432",
  "false",
  "false",
  "",
  "22",
  "",
  "",
  "",
  name,
  legacyId,
];

describe("buildProjectMap", () => {
  it("orders connections by name rather than by key", () => {
    const { projects } = buildProjectMap({
      "a-key": row("users", "beta"),
      "b-key": row("orders", "Alpha"),
    });
    expect(Object.keys(projects)).toEqual(["b-key", "a-key"]);
  });

  it("reads the name and maps each legacy key to its new key", () => {
    const { projects, legacyIds } = buildProjectMap({
      "uuid-1": row("orders", "prod", "prod"),
      "uuid-2": row("users", "fresh"),
    });
    expect(projects["uuid-1"]?.name).toBe("prod");
    expect(legacyIds).toEqual(new Map([["prod", "uuid-1"]]));
  });
});

describe("toDetailArray", () => {
  it("sends the name right after the SSH fields", () => {
    const { projects } = buildProjectMap({ k: row("orders", "prod", "prod") });
    const details = projects.k;
    if (!details) throw new Error("project missing");
    expect(toDetailArray(details)).toEqual(row("orders", "prod").slice(0, 14));
  });
});

describe("projectName", () => {
  it("prefers the name and falls back to the key", () => {
    const { projects } = buildProjectMap({ k: row("orders", "prod"), blank: row("orders", "") });
    expect(projectName(projects, "k")).toBe("prod");
    expect(projectName(projects, "blank")).toBe("blank");
    expect(projectName(projects, "missing")).toBe("missing");
  });
});
