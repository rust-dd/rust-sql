import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

export type ExportFormat = "csv" | "json" | "sql" | "markdown" | "xml";

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function escapeSQL(value: string): string {
  if (value === "null" || value === "NULL") return "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}

function escapeXML(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function toCSV(columns: string[], rows: string[][]): string {
  const header = columns.map(escapeCSV).join(",");
  const body = rows.map((r) => r.map(escapeCSV).join(",")).join("\n");
  return `${header}\n${body}`;
}

export function toJSON(columns: string[], rows: string[][]): string {
  const objects = rows.map((row) => {
    const obj: Record<string, string> = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
  return JSON.stringify(objects, null, 2);
}

export function toSQL(columns: string[], rows: string[][], tableName = "table_name"): string {
  if (rows.length === 0) return `-- No rows to export`;
  const colList = columns.map((c) => `"${c}"`).join(", ");
  return rows
    .map((row) => {
      const vals = row.map(escapeSQL).join(", ");
      return `INSERT INTO "${tableName}" (${colList}) VALUES (${vals});`;
    })
    .join("\n");
}

export function toMarkdown(columns: string[], rows: string[][]): string {
  const header = `| ${columns.join(" | ")} |`;
  const separator = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.map((c) => c.replace(/\|/g, "\\|")).join(" | ")} |`).join("\n");
  return `${header}\n${separator}\n${body}`;
}

export function toXML(columns: string[], rows: string[][]): string {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', "<resultset>"];
  for (const row of rows) {
    lines.push("  <row>");
    columns.forEach((col, i) => {
      lines.push(`    <${col}>${escapeXML(row[i])}</${col}>`);
    });
    lines.push("  </row>");
  }
  lines.push("</resultset>");
  return lines.join("\n");
}

const formatters: Record<ExportFormat, (cols: string[], rows: string[][], table?: string) => string> = {
  csv: toCSV,
  json: toJSON,
  sql: toSQL,
  markdown: toMarkdown,
  xml: toXML,
};

const extensions: Record<ExportFormat, string> = {
  csv: "csv",
  json: "json",
  sql: "sql",
  markdown: "md",
  xml: "xml",
};

const filterNames: Record<ExportFormat, string> = {
  csv: "CSV Files",
  json: "JSON Files",
  sql: "SQL Files",
  markdown: "Markdown Files",
  xml: "XML Files",
};

export async function exportResults(
  format: ExportFormat,
  columns: string[],
  rows: string[][],
  tableName?: string,
) {
  const content = formatters[format](columns, rows, tableName);
  const ext = extensions[format];

  const filePath = await save({
    defaultPath: `export.${ext}`,
    filters: [{ name: filterNames[format], extensions: [ext] }],
  });

  if (!filePath) return; // user cancelled

  await writeTextFile(filePath, content);
}

export function copyToClipboard(
  format: ExportFormat,
  columns: string[],
  rows: string[][],
  tableName?: string,
): Promise<void> {
  const content = formatters[format](columns, rows, tableName);
  return navigator.clipboard.writeText(content);
}
