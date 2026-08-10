SELECT p.proname::text,
       pg_get_function_arguments(p.oid),
       pg_get_function_result(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = $1
  AND p.prokind IN ('f', 'a', 'w')
ORDER BY p.proname
