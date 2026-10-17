import { describe, expect, it } from "vitest";
import type { ProjectDetails, ProjectMap } from "@/types";
import { databaseConnectionHint, serverGroupLabel } from "./labels";

const project = (name: string, database: string): ProjectDetails => ({
  name,
  driver: "PGSQL",
  username: "app",
  password: "",
  database,
  host: "db.local",
  port: "5432",
  ssl: "false",
  sshEnabled: "false",
  sshHost: "",
  sshPort: "22",
  sshUser: "",
  sshPassword: "",
  sshKeyPath: "",
});

const projects: ProjectMap = {
  k1: project("Orders prod", "orders"),
  k2: project("users", "users"),
};

describe("serverGroupLabel", () => {
  it("names a lone connection by its name", () => {
    expect(serverGroupLabel(projects, ["k1"])).toBe("Orders prod");
  });

  it("names a shared server by its address", () => {
    expect(serverGroupLabel(projects, ["k1", "k2"])).toBe("db.local:5432");
  });
});

describe("databaseConnectionHint", () => {
  it("shows the connection name under a shared server when it differs from the database", () => {
    expect(databaseConnectionHint(projects, ["k1", "k2"], "k1", "orders")).toBe("Orders prod");
    expect(databaseConnectionHint(projects, ["k1", "k2"], "k2", "users")).toBeUndefined();
  });

  it("stays quiet when the server row already carries the name", () => {
    expect(databaseConnectionHint(projects, ["k1"], "k1", "orders")).toBeUndefined();
  });
});
