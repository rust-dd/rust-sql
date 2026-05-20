import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const target = env.VITE_BUILD_TARGET ?? "tauri";
  const proxyTarget = env.VITE_RSQL_PROXY_DEV ?? "ws://127.0.0.1:8080";

  const stubPath = path.resolve(__dirname, "./src/lib/platform/stubs/empty.ts");

  const tauriStubPlugin =
    target === "web"
      ? {
          name: "tauri-stub-synthetic-exports",
          load(id: string) {
            if (id === stubPath) {
              return {
                code: "const _stub = {}; export default _stub;",
                syntheticNamedExports: true,
              };
            }
          },
        }
      : null;

  return {
    plugins: [react(), tailwindcss(), ...(tauriStubPlugin ? [tauriStubPlugin] : [])],
    define: {
      __RSQL_BUILD_TARGET__: JSON.stringify(target),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        ...(target === "web"
          ? {
              "@tauri-apps/plugin-dialog": path.resolve(
                __dirname,
                "./src/lib/platform/stubs/empty.ts",
              ),
              "@tauri-apps/plugin-fs": path.resolve(
                __dirname,
                "./src/lib/platform/stubs/empty.ts",
              ),
              "@tauri-apps/plugin-process": path.resolve(
                __dirname,
                "./src/lib/platform/stubs/empty.ts",
              ),
              "@tauri-apps/plugin-updater": path.resolve(
                __dirname,
                "./src/lib/platform/stubs/empty.ts",
              ),
            }
          : {}),
      },
    },
    clearScreen: false,
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host
        ? {
            protocol: "ws",
            host,
            port: 1421,
          }
        : undefined,
      watch: {
        ignored: ["**/crates/rsql-tauri/**", "**/crates/rsql-core/**", "**/target/**"],
      },
      proxy:
        target === "web"
          ? {
              "/ws": {
                target: proxyTarget,
                ws: true,
                changeOrigin: true,
              },
              "/health": {
                target: proxyTarget.replace(/^ws/, "http"),
                changeOrigin: true,
              },
            }
          : undefined,
    },
  };
});
