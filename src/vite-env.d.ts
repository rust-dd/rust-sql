/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PAGE_SIZE?: string;
  readonly VITE_BUILD_TARGET?: "tauri" | "web";
  readonly VITE_RSQL_PROXY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __RSQL_BUILD_TARGET__: "tauri" | "web";
