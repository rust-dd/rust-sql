import { isTauriRuntime } from "@/lib/runtime";
import type { Updater } from "./types";

const TITLE = "RSQL Updates";

function formatReleaseNotes(notes?: string): string {
  const clean = notes?.trim();
  if (!clean) return "No release notes were provided.";
  return clean.length > 500 ? `${clean.slice(0, 497)}...` : clean;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

function getUpdaterErrorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  const lower = text.toLowerCase();
  if (lower.includes("pubkey") || lower.includes("signature")) {
    return "The updater is not fully configured yet. Set TAURI_UPDATER_PUBLIC_KEY at build time and publish signed updater artifacts.";
  }
  if (lower.includes("plugin:updater") || lower.includes("not allowed")) {
    return "The updater plugin is not active in this build.";
  }
  if (lower.includes("could not fetch") || lower.includes("network")) {
    return "Update check failed because the release feed could not be reached.";
  }
  return text;
}

async function makeTauri(): Promise<Updater> {
  const [{ confirm, message }, { relaunch }, updaterMod] = await Promise.all([
    import("@tauri-apps/plugin-dialog"),
    import("@tauri-apps/plugin-process"),
    import("@tauri-apps/plugin-updater"),
  ]);
  const { check } = updaterMod;
  type DownloadEvent = import("@tauri-apps/plugin-updater").DownloadEvent;

  let activeCheck: Promise<void> | null = null;
  let startupCheckStarted = false;

  async function runUpdateFlow(silent: boolean): Promise<void> {
    try {
      const update = await check();
      if (!update) {
        if (!silent) {
          await message("You are already on the latest published version.", {
            title: TITLE,
            kind: "info",
          });
        }
        return;
      }

      const shouldInstall = await confirm(
        `Version ${update.version} is available.\n\n${formatReleaseNotes(update.body)}\n\nDownload and install it now?`,
        { title: TITLE, kind: "info", okLabel: "Install", cancelLabel: "Later" },
      );
      if (!shouldInstall) return;

      let totalBytes = 0;
      let downloadedBytes = 0;
      await update.downloadAndInstall((event: DownloadEvent) => {
        switch (event.event) {
          case "Started":
            totalBytes = event.data.contentLength ?? 0;
            downloadedBytes = 0;
            break;
          case "Progress":
            downloadedBytes += event.data.chunkLength;
            break;
          case "Finished":
            break;
        }
      });

      const sizeText =
        totalBytes > 0
          ? `\n\nDownloaded ${formatBytes(downloadedBytes)} of ${formatBytes(totalBytes)}.`
          : "";

      const restartNow = await confirm(
        `Version ${update.version} has been installed.${sizeText}\n\nRestart now to finish applying the update?`,
        { title: TITLE, kind: "info", okLabel: "Restart", cancelLabel: "Later" },
      );
      if (restartNow) await relaunch();
    } catch (error) {
      console.error("Updater flow failed:", error);
      if (!silent) {
        await message(getUpdaterErrorMessage(error), { title: TITLE, kind: "error" });
      }
    }
  }

  return {
    async checkForUpdates(): Promise<void> {
      if (activeCheck) {
        await message("An update check is already in progress.", {
          title: TITLE,
          kind: "info",
        });
        return activeCheck;
      }
      activeCheck = runUpdateFlow(false).finally(() => {
        activeCheck = null;
      });
      return activeCheck;
    },
    startBackgroundUpdateCheck(): void {
      if (import.meta.env.DEV || startupCheckStarted) return;
      startupCheckStarted = true;
      activeCheck ??= runUpdateFlow(true).finally(() => {
        activeCheck = null;
      });
    },
  };
}

function makeWeb(): Updater {
  return {
    async checkForUpdates(): Promise<void> {},
    startBackgroundUpdateCheck(): void {},
  };
}

let cached: Updater | null = null;

async function resolve(): Promise<Updater> {
  if (cached) return cached;
  cached = isTauriRuntime() ? await makeTauri() : makeWeb();
  return cached;
}

export const updater: Updater = {
  async checkForUpdates() {
    return (await resolve()).checkForUpdates();
  },
  startBackgroundUpdateCheck() {
    void resolve().then((u) => u.startBackgroundUpdateCheck());
  },
};
