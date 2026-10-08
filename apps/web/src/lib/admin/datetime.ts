const IST_OFFSET = "+05:30";

export function parseIstDateTimeLocal(
  value: FormDataEntryValue | string | null | undefined,
): Date | null {
  const text = String(value ?? "").trim();
  if (!text) return null;

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(text)) {
    throw new Error("Invalid date and time.");
  }

  const parsed = new Date(`${text}${IST_OFFSET}`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date and time.");
  }

  return parsed;
}

export function formatIstDateTimeLocal(value: Date | null | undefined): string {
  if (!value) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);

  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}T${byType.get("hour")}:${byType.get("minute")}`;
}
