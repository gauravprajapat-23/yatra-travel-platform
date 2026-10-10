export function safeErrorName(error: unknown): string {
  if (!(error instanceof Error)) return "UnknownError";

  const normalized = error.name.trim().replace(/[^A-Za-z0-9_.-]/g, "");
  return normalized.slice(0, 80) || "Error";
}
