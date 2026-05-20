export type InboundFrame =
  | { id: string; type: "request"; cmd: string; payload?: Record<string, unknown> }
  | { id: string; type: "cancel" };

export type OutboundFrame =
  | { id: string; type: "response"; payload?: unknown; end?: boolean }
  | { id: string; type: "error"; code?: string; message: string }
  | { id: string; type: "event"; event: string; payload?: unknown };

export interface BinaryEnvelope {
  id: string;
  payload: Uint8Array;
}

const UUID_LENGTH = 16;

export function encodeRequest(id: string, cmd: string, payload?: Record<string, unknown>): string {
  return JSON.stringify({ id, type: "request", cmd, payload });
}

export function encodeCancel(id: string): string {
  return JSON.stringify({ id, type: "cancel" });
}

export function parseTextFrame(data: string): OutboundFrame {
  const parsed = JSON.parse(data) as OutboundFrame;
  if (!parsed || typeof parsed !== "object" || !("type" in parsed)) {
    throw new Error(`malformed outbound frame: missing type`);
  }
  return parsed;
}

export function parseBinaryFrame(buf: ArrayBuffer): BinaryEnvelope {
  if (buf.byteLength < UUID_LENGTH) {
    throw new Error(`binary frame too short: ${buf.byteLength} bytes`);
  }
  const view = new Uint8Array(buf);
  const id = uuidFromBytes(view.subarray(0, UUID_LENGTH));
  const payload = view.subarray(UUID_LENGTH);
  return { id, payload };
}

export function uuidFromBytes(bytes: Uint8Array): string {
  if (bytes.length !== 16) throw new Error(`uuid bytes must be 16, got ${bytes.length}`);
  const hex: string[] = [];
  for (let i = 0; i < 16; i++) {
    hex.push(bytes[i].toString(16).padStart(2, "0"));
  }
  return (
    hex.slice(0, 4).join("") +
    "-" +
    hex.slice(4, 6).join("") +
    "-" +
    hex.slice(6, 8).join("") +
    "-" +
    hex.slice(8, 10).join("") +
    "-" +
    hex.slice(10, 16).join("")
  );
}

export function generateRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return uuidFromBytes(bytes);
}
