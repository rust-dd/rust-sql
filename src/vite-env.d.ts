/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PAGE_SIZE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
