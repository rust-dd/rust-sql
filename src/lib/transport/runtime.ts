declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
    __RSQL_PROXY_URL__?: string;
  }
}

export function isTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;
  if (import.meta.env.VITE_BUILD_TARGET === "web") return false;
  return "__TAURI_INTERNALS__" in window && window.__TAURI_INTERNALS__ != null;
}

export function deriveProxyUrl(): string {
  if (typeof window === "undefined") {
    throw new Error("deriveProxyUrl() requires a browser window");
  }
  if (window.__RSQL_PROXY_URL__) return window.__RSQL_PROXY_URL__;
  const envUrl = import.meta.env.VITE_RSQL_PROXY_URL;
  if (typeof envUrl === "string" && envUrl.length > 0) return envUrl;
  const { protocol, host } = window.location;
  const wsProto = protocol === "https:" ? "wss:" : "ws:";
  return `${wsProto}//${host}/ws`;
}
