export const SQL_SNIPPETS = [
  {
    label: "sel",
    detail: "SELECT ... FROM ... WHERE",
    insert:
      "SELECT ${1:*}\nFROM ${2:table_name}\nWHERE ${3:condition}\nLIMIT ${4:100};",
  },
  {
    label: "selc",
    detail: "SELECT COUNT(*)",
    insert: "SELECT COUNT(*)\nFROM ${1:table_name}\nWHERE ${2:1=1};",
  },
  {
    label: "seld",
    detail: "SELECT DISTINCT",
    insert: "SELECT DISTINCT ${1:column}\nFROM ${2:table_name};",
  },
  {
    label: "ins",
    detail: "INSERT INTO ... VALUES",
    insert: "INSERT INTO ${1:table_name} (${2:columns})\nVALUES (${3:values});",
  },
  {
    label: "upd",
    detail: "UPDATE ... SET ... WHERE",
    insert:
      "UPDATE ${1:table_name}\nSET ${2:column} = ${3:value}\nWHERE ${4:condition};",
  },
  {
    label: "del",
    detail: "DELETE FROM ... WHERE",
    insert: "DELETE FROM ${1:table_name}\nWHERE ${2:condition};",
  },
  {
    label: "crt",
    detail: "CREATE TABLE",
    insert:
      "CREATE TABLE ${1:table_name} (\n  ${2:id} SERIAL PRIMARY KEY,\n  ${3:column} ${4:TEXT} NOT NULL\n);",
  },
  {
    label: "alt",
    detail: "ALTER TABLE ADD COLUMN",
    insert:
      "ALTER TABLE ${1:table_name}\nADD COLUMN ${2:column_name} ${3:TEXT};",
  },
  {
    label: "idx",
    detail: "CREATE INDEX",
    insert: "CREATE INDEX ${1:idx_name}\nON ${2:table_name} (${3:column});",
  },
  {
    label: "jn",
    detail: "SELECT ... JOIN ... ON",
    insert:
      "SELECT ${1:*}\nFROM ${2:table1} t1\nJOIN ${3:table2} t2 ON t1.${4:id} = t2.${5:t1_id}\nWHERE ${6:1=1};",
  },
  {
    label: "lj",
    detail: "SELECT ... LEFT JOIN",
    insert:
      "SELECT ${1:*}\nFROM ${2:table1} t1\nLEFT JOIN ${3:table2} t2 ON t1.${4:id} = t2.${5:t1_id};",
  },
  {
    label: "grp",
    detail: "SELECT ... GROUP BY ... ORDER BY",
    insert:
      "SELECT ${1:column}, COUNT(*)\nFROM ${2:table_name}\nGROUP BY ${1:column}\nORDER BY COUNT(*) DESC;",
  },
  {
    label: "cte",
    detail: "WITH ... AS (...) SELECT",
    insert:
      "WITH ${1:cte_name} AS (\n  SELECT ${2:*}\n  FROM ${3:table_name}\n  WHERE ${4:condition}\n)\nSELECT * FROM ${1:cte_name};",
  },
  {
    label: "exist",
    detail: "SELECT ... WHERE EXISTS",
    insert:
      "SELECT *\nFROM ${1:table_name} t1\nWHERE EXISTS (\n  SELECT 1\n  FROM ${2:other_table} t2\n  WHERE t2.${3:fk} = t1.${4:id}\n);",
  },
  {
    label: "upsert",
    detail: "INSERT ... ON CONFLICT DO UPDATE",
    insert:
      "INSERT INTO ${1:table_name} (${2:columns})\nVALUES (${3:values})\nON CONFLICT (${4:constraint})\nDO UPDATE SET ${5:column} = EXCLUDED.${5:column};",
  },
  {
    label: "vw",
    detail: "CREATE VIEW",
    insert:
      "CREATE OR REPLACE VIEW ${1:view_name} AS\nSELECT ${2:*}\nFROM ${3:table_name}\nWHERE ${4:condition};",
  },
  {
    label: "fn",
    detail: "CREATE FUNCTION",
    insert:
      "CREATE OR REPLACE FUNCTION ${1:func_name}(${2:params})\nRETURNS ${3:return_type}\nLANGUAGE plpgsql\nAS \\$\\$\nBEGIN\n  ${4:-- body}\nEND;\n\\$\\$;",
  },
  {
    label: "trg",
    detail: "CREATE TRIGGER",
    insert:
      "CREATE TRIGGER ${1:trigger_name}\n${2:BEFORE} ${3:INSERT} ON ${4:table_name}\nFOR EACH ROW\nEXECUTE FUNCTION ${5:func_name}();",
  },
  {
    label: "txn",
    detail: "BEGIN ... COMMIT",
    insert: "BEGIN;\n  ${1:-- statements}\nCOMMIT;",
  },
];
