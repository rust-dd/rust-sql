import { isTauriRuntime } from "@/lib/runtime";

declare global {
  interface Window {
    __RSQL_PROXY_URL__?: string;
  }
}

export { isTauriRuntime };

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
