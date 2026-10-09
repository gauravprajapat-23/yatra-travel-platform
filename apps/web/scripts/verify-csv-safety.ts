import assert from "node:assert/strict";
import { safeCsvCell } from "../src/lib/admin/csv";

assert.equal(safeCsvCell("plain"), '"plain"');
assert.equal(safeCsvCell('He said "hello"'), '"He said ""hello"""');
assert.equal(safeCsvCell("a,b"), '"a,b"');
assert.equal(safeCsvCell("line1\nline2"), '"line1\nline2"');

for (const dangerous of [
  "=HYPERLINK(\"https://example.test\")",
  "+1+1",
  "-1+1",
  "@SUM(A1:A2)",
]) {
  const escaped = safeCsvCell(dangerous);
  assert.equal(escaped.startsWith("\"'"), true);
  assert.equal(escaped.includes(dangerous), true);
}

assert.equal(safeCsvCell(123n), '"123"');
assert.equal(safeCsvCell(null), '""');

console.log("CSV spreadsheet-safety verification passed.");
