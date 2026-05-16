export function ddlTableQuery(schema: string, table: string): string {
  return `-- Generate CREATE TABLE DDL for "${schema}"."${table}"
SELECT 'CREATE TABLE "' || schemaname || '"."' || tablename || '" (' || E'\\n' ||
  string_agg('  "' || column_name || '" ' || data_type ||
    CASE WHEN character_maximum_length IS NOT NULL THEN '(' || character_maximum_length || ')' ELSE '' END ||
    CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
    CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
    ',' || E'\\n' ORDER BY ordinal_position) || E'\\n' || ');' AS ddl
FROM information_schema.columns c
JOIN pg_tables t ON t.schemaname = c.table_schema AND t.tablename = c.table_name
WHERE c.table_schema = '${schema}' AND c.table_name = '${table}'
GROUP BY schemaname, tablename;`;
}

export function ddlViewQuery(schema: string, view: string): string {
  return `-- View definition for "${schema}"."${view}"
SELECT pg_get_viewdef('"${schema}"."${view}"'::regclass, true) AS view_definition;`;
}

export function ddlFunctionQuery(schema: string, fnName: string): string {
  return `-- Function definition for "${schema}"."${fnName}"
SELECT pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = '${schema}' AND p.proname = '${fnName}'
LIMIT 1;`;
}
