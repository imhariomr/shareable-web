export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  const formatted = exponent === 0 ? value.toString() : value.toFixed(value < 10 ? 1 : 0);
  return `${formatted} ${units[exponent]}`;
}

const CONTROL_CHARS_PATTERN = new RegExp("[\\x00-\\x1f\\x7f]", "g");

export function sanitizeFileName(name: unknown, fallback = "file"): string {
  if (typeof name !== "string") return fallback;
  const cleaned = name
    .replace(CONTROL_CHARS_PATTERN, "")
    .replace(/[\\/]/g, "_")
    .trim()
    .slice(0, 255);
  return cleaned.length > 0 ? cleaned : fallback;
}

export function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
