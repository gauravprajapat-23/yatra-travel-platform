"use client";

import { useMemo, useState } from "react";

function factLines(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === "string") {
    return value.trim() ? [value.trim()] : [];
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => factLines(item)).slice(0, 50);
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .flatMap(([key, entry]) =>
        factLines(entry).map(
          (item) => `${key.replaceAll("_", " ")}: ${item}`,
        ),
      )
      .slice(0, 50);
  }
  return [];
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

export function AdminJsonListField({
  name,
  label,
  defaultValue,
  hint,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue: unknown;
  hint?: string;
  placeholder?: string;
}) {
  const initialLines = useMemo(
    () => factLines(defaultValue).join("\n"),
    [defaultValue],
  );
  const [advanced, setAdvanced] = useState(false);
  const [lines, setLines] = useState(initialLines);
  const [json, setJson] = useState(stringify(defaultValue));
  const [edited, setEdited] = useState(false);

  function guidedJson() {
    return JSON.stringify(
      lines
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    );
  }

  function toggleMode() {
    if (!advanced) {
      setJson(edited ? JSON.stringify(JSON.parse(guidedJson()), null, 2) : stringify(defaultValue));
      setAdvanced(true);
      return;
    }

    try {
      const parsed = json.trim() ? JSON.parse(json) : [];
      setLines(factLines(parsed).join("\n"));
      setAdvanced(false);
    } catch {
      window.alert("Advanced JSON must be valid before returning to guided mode.");
    }
  }

  const submittedValue = edited
    ? advanced
      ? json
      : guidedJson()
    : stringify(defaultValue);

  return (
    <div className="admin-json-list-field">
      <input type="hidden" name={name} value={submittedValue} />

      <div className="admin-json-list-field__header">
        <span className="admin-field__label">{label}</span>
        <button
          className="admin-field__link-button"
          type="button"
          onClick={toggleMode}
        >
          {advanced ? "Use Guided List" : "Advanced JSON"}
        </button>
      </div>

      {advanced ? (
        <textarea
          value={json}
          onChange={(event) => {
            setEdited(true);
            setJson(event.target.value);
          }}
          rows={8}
          spellCheck={false}
          aria-label={`${label} JSON`}
        />
      ) : (
        <textarea
          value={lines}
          onChange={(event) => {
            setEdited(true);
            setLines(event.target.value);
          }}
          rows={6}
          placeholder={placeholder}
          aria-label={label}
        />
      )}

      <small className="admin-field__hint">
        {advanced
          ? "Advanced mode preserves custom JSON structures."
          : hint ?? "Enter one item per line."}
      </small>
    </div>
  );
}
