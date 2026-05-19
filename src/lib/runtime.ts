declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

declare const __RSQL_BUILD_TARGET__: "tauri" | "web";

export function isTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;
  if (__RSQL_BUILD_TARGET__ === "web") return false;
  return "__TAURI_INTERNALS__" in window && window.__TAURI_INTERNALS__ != null;
}

export function isWebBuild(): boolean {
  return __RSQL_BUILD_TARGET__ === "web";
}
