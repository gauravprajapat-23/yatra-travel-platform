const spreadsheetFormulaPrefix = /^[=+\-@]/;

export function safeCsvCell(value: unknown): string {
  let text = String(value ?? "");

  if (spreadsheetFormulaPrefix.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replaceAll('"', '""')}"`;
}
