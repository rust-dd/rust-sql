/**
 * Classifies a SQL statement as "select" (read-only) or "write" (mutation).
 * Used to decide whether to auto-execute or just display the query.
 */
export function classifySQL(sql: string): "select" | "write" {
  const trimmed = sql.trim().replace(/^--[^\n]*\n/gm, "").trim();
  const upper = trimmed.toUpperCase();

  const readOnlyPrefixes = [
    "SELECT",
    "EXPLAIN",
    "SHOW",
    "WITH",
  ];

  for (const prefix of readOnlyPrefixes) {
    if (upper.startsWith(prefix)) {
      // WITH can contain INSERT/UPDATE/DELETE (CTEs)
      if (prefix === "WITH") {
        const hasWrite = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)\b/i.test(trimmed);
        if (hasWrite) return "write";
      }
      return "select";
    }
  }

  return "write";
}
