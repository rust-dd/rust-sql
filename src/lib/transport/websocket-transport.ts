import {
  type BinaryEnvelope,
  encodeCancel,
  encodeRequest,
  generateRequestId,
  type OutboundFrame,
  parseBinaryFrame,
  parseTextFrame,
} from "./protocol";
import { ExponentialBackoff } from "./reconnect";
import {
  type EventHandler,
  type InvokeOptions,
  type StreamHandle,
  type Transport,
  TransportError,
  type UnlistenFn,
} from "./types";

type Pending = {
  resolveJson: (value: unknown) => void;
  resolveBinary: (value: Uint8Array) => void;
  reject: (err: unknown) => void;
  expectBinary: boolean;
};

type EventBus = Map<string, Set<EventHandler<unknown>>>;

const BUFFERED_WARN_THRESHOLD = 64 * 1024 * 1024;

export class WebSocketTransport implements Transport {
  private socket: WebSocket | null = null;
  private connectingPromise: Promise<void> | null = null;
  private readonly pending = new Map<string, Pending>();
  private readonly events: EventBus = new Map();
  private readonly backoff = new ExponentialBackoff();
  private closedByUser = false;
  private backpressureWarned = false;

  constructor(private readonly url: string) {}

  async invoke<T>(cmd: string, args?: Record<string, unknown>, opts?: InvokeOptions): Promise<T> {
    return (await this.dispatch(cmd, args, opts, false)) as T;
  }

  async invokeRaw(
    cmd: string,
    args?: Record<string, unknown>,
    opts?: InvokeOptions,
  ): Promise<Uint8Array> {
    return (await this.dispatch(cmd, args, opts, true)) as Uint8Array;
  }

  async listen<T>(event: string, handler: EventHandler<T>): Promise<UnlistenFn> {
    await this.ensureConnected();
    const bucket = this.events.get(event) ?? new Set();
    bucket.add(handler as EventHandler<unknown>);
    this.events.set(event, bucket);
    return () => {
      const set = this.events.get(event);
      if (!set) return;
      set.delete(handler as EventHandler<unknown>);
      if (set.size === 0) this.events.delete(event);
    };
  }

  async stream<T>(
    cmd: string,
    args: Record<string, unknown>,
    event: string,
    onFrame: EventHandler<T>,
  ): Promise<StreamHandle> {
    const unlisten = await this.listen<T>(event, onFrame);
    let cancelId: string | null = null;
    const startedAt = generateRequestId();
    cancelId = startedAt;
    this.dispatch(cmd, { ...args, __stream_id: startedAt }, undefined, false).catch((err) => {
      console.error(`stream(${cmd}) failed`, err);
    });
    return {
      cancel: () => {
        unlisten();
        if (cancelId) this.send(encodeCancel(cancelId));
      },
    };
  }

  close(): void {
    this.closedByUser = true;
    this.socket?.close(1000, "client shutdown");
    for (const p of this.pending.values())
      p.reject(new TransportError("CLOSED", "transport closed"));
    this.pending.clear();
    this.events.clear();
  }

  private async dispatch(
    cmd: string,
    args: Record<string, unknown> | undefined,
    opts: InvokeOptions | undefined,
    expectBinary: boolean,
  ): Promise<unknown> {
    await this.ensureConnected();
    const id = generateRequestId();
    return new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, {
        resolveJson: (v) => resolve(v),
        resolveBinary: (v) => resolve(v),
        reject,
        expectBinary,
      });
      opts?.signal?.addEventListener("abort", () => {
        if (this.pending.delete(id)) {
          this.send(encodeCancel(id));
          reject(new TransportError("ABORTED", "request aborted"));
        }
      });
      this.send(encodeRequest(id, cmd, args));
    });
  }

  private send(text: string): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new TransportError("CLOSED", "websocket is not open");
    }
    if (this.socket.bufferedAmount > BUFFERED_WARN_THRESHOLD && !this.backpressureWarned) {
      console.warn(
        `WebSocketTransport: bufferedAmount=${this.socket.bufferedAmount} exceeds threshold`,
      );
      this.backpressureWarned = true;
    } else if (this.socket.bufferedAmount < BUFFERED_WARN_THRESHOLD / 4) {
      this.backpressureWarned = false;
    }
    this.socket.send(text);
  }

  private async ensureConnected(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) return;
    if (this.connectingPromise) return this.connectingPromise;
    this.connectingPromise = this.connect();
    try {
      await this.connectingPromise;
    } finally {
      this.connectingPromise = null;
    }
  }

  private connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.url);
      ws.binaryType = "arraybuffer";
      this.socket = ws;
      ws.addEventListener("open", () => {
        this.backoff.reset();
        resolve();
      });
      ws.addEventListener("message", (e) => this.onMessage(e));
      ws.addEventListener("close", () => this.onClose());
      ws.addEventListener("error", (err) => {
        if (ws.readyState === WebSocket.CONNECTING) reject(err);
      });
    });
  }

  private onMessage(event: MessageEvent): void {
    if (typeof event.data === "string") {
      this.handleTextFrame(event.data);
      return;
    }
    if (event.data instanceof ArrayBuffer) {
      this.handleBinaryFrame(event.data);
      return;
    }
    console.error("WebSocketTransport: unexpected message type", event.data);
  }

  private handleTextFrame(data: string): void {
    let frame: OutboundFrame;
    try {
      frame = parseTextFrame(data);
    } catch (err) {
      console.error("WebSocketTransport: malformed text frame", err);
      return;
    }
    if (frame.type === "response") {
      const p = this.pending.get(frame.id);
      if (!p) return;
      this.pending.delete(frame.id);
      if (p.expectBinary) {
        p.reject(new TransportError("PROTOCOL", "expected binary response, got JSON"));
      } else {
        p.resolveJson(frame.payload);
      }
      return;
    }
    if (frame.type === "error") {
      const p = this.pending.get(frame.id);
      if (!p) return;
      this.pending.delete(frame.id);
      p.reject(new TransportError(frame.code, frame.message));
      return;
    }
    if (frame.type === "event") {
      this.dispatchEvent(frame.event, frame.payload);
    }
  }

  private handleBinaryFrame(buf: ArrayBuffer): void {
    let env: BinaryEnvelope;
    try {
      env = parseBinaryFrame(buf);
    } catch (err) {
      console.error("WebSocketTransport: malformed binary frame", err);
      return;
    }
    const p = this.pending.get(env.id);
    if (!p) return;
    this.pending.delete(env.id);
    if (p.expectBinary) {
      p.resolveBinary(env.payload);
    } else {
      p.resolveJson(new TextDecoder().decode(env.payload));
    }
  }

  private dispatchEvent(event: string, payload: unknown): void {
    const bucket = this.events.get(event);
    if (!bucket) return;
    for (const h of bucket) {
      try {
        h(payload);
      } catch (err) {
        console.error(`WebSocketTransport: event handler for "${event}" threw`, err);
      }
    }
  }

  private onClose(): void {
    if (this.closedByUser) return;
    for (const p of this.pending.values())
      p.reject(new TransportError("DISCONNECTED", "websocket closed"));
    this.pending.clear();
    const delay = this.backoff.next();
    console.warn(`WebSocketTransport: reconnecting in ${delay}ms`);
    setTimeout(() => {
      if (this.closedByUser) return;
      this.connect().catch((err) => console.error("WebSocketTransport: reconnect failed", err));
    }, delay);
  }
}
