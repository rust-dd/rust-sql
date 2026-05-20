import type { EventHandler, InvokeOptions, StreamHandle, Transport, UnlistenFn } from "./types";

type TauriCore = typeof import("@tauri-apps/api/core");
type TauriEvent = typeof import("@tauri-apps/api/event");

export class TauriTransport implements Transport {
  private corePromise: Promise<TauriCore> | null = null;
  private eventPromise: Promise<TauriEvent> | null = null;

  private core(): Promise<TauriCore> {
    this.corePromise ??= import("@tauri-apps/api/core");
    return this.corePromise;
  }

  private event(): Promise<TauriEvent> {
    this.eventPromise ??= import("@tauri-apps/api/event");
    return this.eventPromise;
  }

  async invoke<T>(cmd: string, args?: Record<string, unknown>, _opts?: InvokeOptions): Promise<T> {
    const { invoke } = await this.core();
    return invoke<T>(cmd, args);
  }

  async invokeRaw(
    cmd: string,
    args?: Record<string, unknown>,
    _opts?: InvokeOptions,
  ): Promise<Uint8Array> {
    const { invoke } = await this.core();
    const result = await invoke<ArrayBuffer | Uint8Array | string>(cmd, args);
    if (result instanceof Uint8Array) return result;
    if (result instanceof ArrayBuffer) return new Uint8Array(result);
    return new TextEncoder().encode(result);
  }

  async listen<T>(event: string, handler: EventHandler<T>): Promise<UnlistenFn> {
    const { listen } = await this.event();
    return await listen<T>(event, (e) => handler(e.payload));
  }

  async stream<T>(
    cmd: string,
    args: Record<string, unknown>,
    event: string,
    onFrame: EventHandler<T>,
  ): Promise<StreamHandle> {
    const unlisten = await this.listen<T>(event, onFrame);
    let cancelled = false;
    this.invoke(cmd, args).catch((err) => {
      if (!cancelled) console.error(`stream(${cmd}) failed`, err);
    });
    return {
      cancel: () => {
        cancelled = true;
        unlisten();
      },
    };
  }
}
