import { deriveProxyUrl, isTauriRuntime } from "./runtime";
import { TauriTransport } from "./tauri-transport";
import type { Transport } from "./types";
import { WebSocketTransport } from "./websocket-transport";

function createTransport(): Transport {
  if (isTauriRuntime()) return new TauriTransport();
  return new WebSocketTransport(deriveProxyUrl());
}

export const transport: Transport = createTransport();

export type { EventHandler, InvokeOptions, StreamHandle, Transport, UnlistenFn } from "./types";
export { TransportError } from "./types";
