const NOTIFY_THRESHOLD_MS = 5000;
const DEFAULT_PAGE_SIZE = 2_000;
const PAGE_SIZE_RAW = Number(import.meta.env.VITE_PAGE_SIZE ?? DEFAULT_PAGE_SIZE);
export const PAGE_SIZE =
  Number.isFinite(PAGE_SIZE_RAW) && PAGE_SIZE_RAW >= 100
    ? Math.floor(PAGE_SIZE_RAW)
    : DEFAULT_PAGE_SIZE;
export const CELL_SEP = "\x1F";
export const ROW_SEP = "\x1E";

export function isQueryCancelledError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("canceling statement due to user request") ||
    lower.includes("cancelling statement due to user request") ||
    lower.includes("query canceled") ||
    lower.includes("query cancelled") ||
    lower.includes("statement timeout")
  );
}

export function notifyQueryComplete(
  sql: string,
  time: number,
  success: boolean,
  rowCount?: number,
) {
  if (document.hasFocus() || time < NOTIFY_THRESHOLD_MS) return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const preview = sql.slice(0, 60).replace(/\n/g, " ");
  const body = success
    ? `${rowCount?.toLocaleString() ?? 0} rows in ${(time / 1000).toFixed(1)}s`
    : `Query failed after ${(time / 1000).toFixed(1)}s`;
  new Notification(success ? "Query Complete" : "Query Failed", { body: `${preview}\n${body}` });
}
