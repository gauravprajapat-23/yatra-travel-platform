"use client";

import { useState } from "react";

export function AdminTextareaField({
  name,
  label,
  id,
  defaultValue = "",
  maxLength,
  minLength,
  rows = 5,
  required = false,
  placeholder,
  hint,
  wide = false,
}: {
  name: string;
  label: string;
  id?: string;
  defaultValue?: string;
  maxLength?: number;
  minLength?: number;
  rows?: number;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  wide?: boolean;
}) {
  const inputId = id ?? `admin-textarea-${name}`;
  const [value, setValue] = useState(defaultValue);

  return (
    <label
      className={wide ? "admin-field admin-field--wide" : "admin-field"}
      htmlFor={inputId}
    >
      <span className="admin-field__label">
        {label}
        {required ? <b aria-hidden="true">*</b> : null}
      </span>

      <textarea
        id={inputId}
        name={name}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={maxLength}
        minLength={minLength}
        rows={rows}
        required={required}
        placeholder={placeholder}
      />

      <span className="admin-field__footer">
        <small className="admin-field__hint">{hint ?? ""}</small>
        {maxLength ? (
          <small
            className={
              value.length >= maxLength
                ? "admin-field__count admin-field__count--limit"
                : "admin-field__count"
            }
          >
            {value.length}/{maxLength}
          </small>
        ) : null}
      </span>
    </label>
  );
}
