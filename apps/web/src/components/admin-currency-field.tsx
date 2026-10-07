"use client";

import { useState } from "react";

export function AdminCurrencyField({
  name = "currency",
  label = "Currency",
  defaultValue = "INR",
  id,
}: {
  name?: string;
  label?: string;
  defaultValue?: string;
  id?: string;
}) {
  const inputId = id ?? `admin-currency-${name}`;
  const [value, setValue] = useState(
    defaultValue.trim().toUpperCase().slice(0, 3),
  );

  return (
    <label className="admin-field" htmlFor={inputId}>
      <span className="admin-field__label">
        {label}
        <b aria-hidden="true">*</b>
      </span>
      <input
        id={inputId}
        name={name}
        value={value}
        onChange={(event) =>
          setValue(
            event.target.value
              .replace(/[^a-zA-Z]/g, "")
              .toUpperCase()
              .slice(0, 3),
          )
        }
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        minLength={3}
        maxLength={3}
        pattern="[A-Z]{3}"
        required
      />
      <small className="admin-field__hint">
        3-letter ISO currency code, for example INR or USD.
      </small>
    </label>
  );
}
