export type UnlistenFn = () => void;

export interface StreamHandle {
  cancel: () => void;
}

export interface InvokeOptions {
  signal?: AbortSignal;
}

export type EventHandler<T> = (payload: T) => void;

export interface Transport {
  invoke<T>(cmd: string, args?: Record<string, unknown>, opts?: InvokeOptions): Promise<T>;
  invokeRaw(cmd: string, args?: Record<string, unknown>, opts?: InvokeOptions): Promise<Uint8Array>;
  listen<T>(event: string, handler: EventHandler<T>): Promise<UnlistenFn>;
  stream<T>(
    cmd: string,
    args: Record<string, unknown>,
    event: string,
    onFrame: EventHandler<T>,
  ): Promise<StreamHandle>;
}

export class TransportError extends Error {
  constructor(public readonly code: string | undefined, message: string) {
    super(message);
    this.name = "TransportError";
  }
}
