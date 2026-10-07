"use client";

import { useState } from "react";

export function AdminTextInputField({
  name,
  label,
  id,
  defaultValue = "",
  maxLength,
  minLength,
  required = false,
  placeholder,
  hint,
  wide = false,
  autoComplete,
}: {
  name: string;
  label: string;
  id?: string;
  defaultValue?: string;
  maxLength?: number;
  minLength?: number;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  wide?: boolean;
  autoComplete?: string;
}) {
  const inputId = id ?? `admin-text-${name}`;
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

      <input
        id={inputId}
        name={name}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={maxLength}
        minLength={minLength}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
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
