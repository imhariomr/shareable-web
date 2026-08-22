export const CHUNK_SIZE = 256 * 1024;
export const MAX_BUFFER_BYTES = 4 * 1024 * 1024;
export const RESUME_BUFFER_BYTES = 1 * 1024 * 1024;
export const CONNECT_TIMEOUT_MS = 20_000;
export const HEARTBEAT_INTERVAL_MS = 5000;
export const HEARTBEAT_TIMEOUT_MS = 12000;

export type ControlMessage =
  | { type: "ping" }
  | { type: "pong" }
  | { type: "file-meta"; id: string; name: string; size: number; mimeType: string; createdAt: number }
  | { type: "file-end"; id: string; checksum: number }
  | { type: "file-cancel"; id: string };

export function adler32(buf: Uint8Array, prev = 1): number {
  let a = prev & 0xffff;
  let b = (prev >>> 16) & 0xffff;
  for (let i = 0; i < buf.length; i++) {
    a = (a + buf[i]) % 65521;
    b = (b + a) % 65521;
  }
  return (b << 16) | a;
}
