import { describe, expect, it } from "vitest";
import { changesSchema } from "./ddl-detect";

describe("changesSchema", () => {
  it("recognises DDL regardless of case and leading whitespace", () => {
    expect(changesSchema("  create table t (id int)")).toBe(true);
    expect(changesSchema("ALTER TABLE t ADD COLUMN c text")).toBe(true);
    expect(changesSchema("drop view v")).toBe(true);
    expect(changesSchema("REFRESH MATERIALIZED VIEW mv")).toBe(true);
  });

  it("does not treat data changes as schema changes", () => {
    expect(changesSchema("INSERT INTO t VALUES (1)")).toBe(false);
    expect(changesSchema("UPDATE t SET c = 1")).toBe(false);
    expect(changesSchema("DELETE FROM t WHERE id = 1")).toBe(false);
    expect(changesSchema("SELECT * FROM t")).toBe(false);
  });

  it("finds DDL anywhere in a multi-statement script", () => {
    expect(changesSchema("SELECT 1; CREATE TABLE t (id int);")).toBe(true);
  });

  it("ignores keywords that only appear in comments or strings", () => {
    expect(changesSchema("-- create table t\nSELECT 1")).toBe(false);
    expect(changesSchema("/* drop table t */ SELECT 1")).toBe(false);
  });

  it("is not fooled by a column named like a keyword", () => {
    expect(changesSchema("SELECT create_date FROM t")).toBe(false);
  });

  it("handles an empty statement", () => {
    expect(changesSchema("")).toBe(false);
    expect(changesSchema("   ;;  ")).toBe(false);
  });
});
