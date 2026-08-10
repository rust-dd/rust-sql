/**
 * Whether a statement can have changed the catalog.
 *
 * Only real DDL invalidates the schema index. INSERT, UPDATE and DELETE
 * deliberately do not: they cannot change the schema, and treating them as
 * invalidating would reload the index constantly during ordinary work.
 */

const DDL_KEYWORDS = new Set([
  "CREATE",
  "ALTER",
  "DROP",
  "TRUNCATE",
  "COMMENT",
  "GRANT",
  "REVOKE",
  "REFRESH",
]);

export function changesSchema(sql: string): boolean {
  const withoutComments = sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");

  // A script can lead with anything, so every statement is considered.
  for (const statement of withoutComments.split(";")) {
    const first = statement.trim().split(/\s+/)[0];
    if (first && DDL_KEYWORDS.has(first.toUpperCase())) return true;
  }
  return false;
}
