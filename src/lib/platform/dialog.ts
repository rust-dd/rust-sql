import { isTauriRuntime } from "@/lib/runtime";
import type { Dialog, OpenFileOptions, OpenFileResult, SaveFileOptions } from "./types";

async function makeTauri(): Promise<Dialog> {
  const [{ open, save }, { writeTextFile }] = await Promise.all([
    import("@tauri-apps/plugin-dialog"),
    import("@tauri-apps/plugin-fs"),
  ]);
  return {
    async saveFile(opts: SaveFileOptions): Promise<boolean> {
      const filePath = await save({
        defaultPath: opts.defaultName,
        filters: opts.filters,
      });
      if (!filePath) return false;
      await writeTextFile(filePath, opts.content);
      return true;
    },
    async openFile(opts: OpenFileOptions): Promise<OpenFileResult | null> {
      const selected = await open({
        multiple: false,
        filters: opts.filters,
      });
      if (!selected) return null;
      const path = typeof selected === "string" ? selected : (selected as { path: string }).path;
      return { kind: "path", path };
    },
  };
}

function makeWeb(): Dialog {
  return {
    async saveFile(opts: SaveFileOptions): Promise<boolean> {
      const blob = new Blob([opts.content], {
        type: opts.mime ?? "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = opts.defaultName;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
      return true;
    },
    openFile(opts: OpenFileOptions): Promise<OpenFileResult | null> {
      return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = false;
        if (opts.filters?.length) {
          const accept = opts.filters
            .flatMap((f) => f.extensions)
            .map((e) => (e.startsWith(".") ? e : `.${e}`))
            .join(",");
          if (accept) input.accept = accept;
        }
        input.style.display = "none";
        const cleanup = () => {
          input.removeEventListener("change", onChange);
          input.removeEventListener("cancel", onCancel);
          if (input.parentNode) input.parentNode.removeChild(input);
        };
        const onChange = () => {
          const file = input.files?.[0];
          cleanup();
          resolve(file ? { kind: "file", file } : null);
        };
        const onCancel = () => {
          cleanup();
          resolve(null);
        };
        input.addEventListener("change", onChange);
        input.addEventListener("cancel", onCancel);
        document.body.appendChild(input);
        input.click();
      });
    },
  };
}

let cached: Dialog | null = null;

async function resolve(): Promise<Dialog> {
  if (cached) return cached;
  cached = isTauriRuntime() ? await makeTauri() : makeWeb();
  return cached;
}

export const dialog: Dialog = {
  async saveFile(opts) {
    return (await resolve()).saveFile(opts);
  },
  async openFile(opts) {
    return (await resolve()).openFile(opts);
  },
};
