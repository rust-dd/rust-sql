import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import type { CellValue } from "@/lib/wire";

export type ExportFormat = "csv" | "json" | "sql" | "markdown" | "xml";

function escapeCSVText(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** SQL NULL becomes an unquoted empty field, the usual CSV convention. */
function escapeCSV(cell: CellValue): string {
  return cell === null ? "" : escapeCSVText(cell);
}

/**
 * Only a real SQL NULL becomes the NULL keyword. The text value "null" is
 * exported as a quoted literal, which earlier releases silently turned into NULL.
 */
function escapeSQL(cell: CellValue): string {
  if (cell === null) return "NULL";
  return `'${cell.replace(/'/g, "''")}'`;
}

function escapeXML(cell: CellValue): string {
  if (cell === null) return "";
  return cell
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function toCSV(columns: string[], rows: CellValue[][]): string {
  const header = columns.map(escapeCSVText).join(",");
  const body = rows.map((r) => r.map(escapeCSV).join(",")).join("\n");
  return `${header}\n${body}`;
}

/** SQL NULL is exported as JSON null rather than the string "null". */
export function toJSON(columns: string[], rows: CellValue[][]): string {
  const objects = rows.map((row) => {
    const obj: Record<string, CellValue> = {};
    columns.forEach((col, i) => {
      obj[col] = row[i] ?? null;
    });
    return obj;
  });
  return JSON.stringify(objects, null, 2);
}

export function toSQL(columns: string[], rows: CellValue[][], tableName = "table_name"): string {
  if (rows.length === 0) return `-- No rows to export`;
  const colList = columns.map((c) => `"${c}"`).join(", ");
  return rows
    .map((row) => {
      const vals = row.map(escapeSQL).join(", ");
      return `INSERT INTO "${tableName}" (${colList}) VALUES (${vals});`;
    })
    .join("\n");
}

export function toMarkdown(columns: string[], rows: CellValue[][]): string {
  const header = `| ${columns.join(" | ")} |`;
  const separator = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows
    .map((r) => `| ${r.map((c) => (c === null ? "" : c.replace(/\|/g, "\\|"))).join(" | ")} |`)
    .join("\n");
  return `${header}\n${separator}\n${body}`;
}

export function toXML(columns: string[], rows: CellValue[][]): string {
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

const formatters: Record<
  ExportFormat,
  (cols: string[], rows: CellValue[][], table?: string) => string
> = {
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
  rows: CellValue[][],
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
  rows: CellValue[][],
  tableName?: string,
): Promise<void> {
  const content = formatters[format](columns, rows, tableName);
  return navigator.clipboard.writeText(content);
}
