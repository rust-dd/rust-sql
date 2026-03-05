/**
 * Parse a simple SELECT query to extract the target table.
 * Returns null for complex queries (JOINs, subqueries, UNIONs, CTEs).
 */
export function parseSelectTable(sql: string): { schema: string; table: string } | null {
  const normalized = sql.trim().replace(/;+\s*$/, "").replace(/\s+/g, " ");

  // Reject complex queries
  if (/\b(join|union|intersect|except)\b/i.test(normalized)) return null;
  if (/\bwith\s+\w+\s+as\s*\(/i.test(normalized)) return null;
  if (/\(\s*select\b/i.test(normalized)) return null;

  // Must start with SELECT
  if (!/^\s*select\b/i.test(normalized)) return null;

  // Extract table after FROM: [schema.]table
  const fromMatch = normalized.match(/\bfrom\s+(?:"?(\w+)"?\.)?"?(\w+)"?/i);
  if (!fromMatch) return null;

  return { schema: fromMatch[1] ?? "public", table: fromMatch[2] };
}

export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export function quoteLiteral(value: string): string {
  if (value.toLowerCase() === "null") return "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}

export function generateUpdate(
  schema: string,
  table: string,
  columns: string[],
  originalRow: string[],
  changes: Map<number, string>,
  pkColumns: string[],
): string {
  const target = `${quoteIdent(schema)}.${quoteIdent(table)}`;

  const setClauses: string[] = [];
  for (const [colIdx, newValue] of changes) {
    setClauses.push(`${quoteIdent(columns[colIdx])} = ${quoteLiteral(newValue)}`);
  }

  const where = buildPKWhere(columns, originalRow, pkColumns);
  return `UPDATE ${target} SET ${setClauses.join(", ")} WHERE ${where}`;
}

export function generateDelete(
  schema: string,
  table: string,
  columns: string[],
  originalRow: string[],
  pkColumns: string[],
): string {
  const target = `${quoteIdent(schema)}.${quoteIdent(table)}`;
  const where = buildPKWhere(columns, originalRow, pkColumns);
  return `DELETE FROM ${target} WHERE ${where}`;
}

function buildPKWhere(columns: string[], row: string[], pkColumns: string[]): string {
  return pkColumns
    .map((pk) => {
      const idx = columns.indexOf(pk);
      if (idx === -1) return null;
      const val = row[idx];
      return val.toLowerCase() === "null"
        ? `${quoteIdent(pk)} IS NULL`
        : `${quoteIdent(pk)} = ${quoteLiteral(val)}`;
    })
    .filter(Boolean)
    .join(" AND ");
}
