export type TableRef = { schema?: string; table: string };

export function stripQuotes(s: string) {
  return s.replaceAll('"', "");
}

export function extractAliasMap(sql: string): Record<string, TableRef> {
  const map: Record<string, TableRef> = {};
  const re =
    /(from|join)\s+("?[A-Za-z0-9_]+"?)(?:\s*\.\s*("?[A-Za-z0-9_]+"?))?(?:\s+as)?\s+("?[A-Za-z0-9_]+"?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const schemaMaybe = m[3] ? stripQuotes(m[2]) : undefined;
    const table = stripQuotes(m[3] ?? m[2]);
    const alias = stripQuotes(m[4]);
    map[alias] = { schema: schemaMaybe, table };
  }
  return map;
}

export function genAlias(table: string) {
  const raw = table.replace(/"/g, "");
  const parts = raw.split("_").filter(Boolean);
  if (parts.length === 0) return raw.slice(0, 1);
  if (parts.length === 1) return parts[0].slice(0, 1);
  return parts.map((p) => p[0]).join("");
}
