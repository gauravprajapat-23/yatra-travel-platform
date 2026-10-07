"use client";

import { useEffect, useState } from "react";

export function AdminMoneyField({
  name,
  label,
  currency = "INR",
  defaultValue = "",
  placeholder,
  required = false,
  hint,
  currencyInputId,
}: {
  name: string;
  label: string;
  currency?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  currencyInputId?: string;
}) {
  const id = `admin-money-${name}`;
  const [displayCurrency, setDisplayCurrency] = useState(
    currency.trim().toUpperCase() || "INR",
  );

  useEffect(() => {
    if (!currencyInputId) return;

    const element = document.getElementById(currencyInputId);
    if (!(element instanceof HTMLInputElement)) return;

    const sync = () => {
      const next = element.value.trim().toUpperCase();
      setDisplayCurrency(next || currency.trim().toUpperCase() || "INR");
    };

    sync();
    element.addEventListener("input", sync);
    element.addEventListener("change", sync);

    return () => {
      element.removeEventListener("input", sync);
      element.removeEventListener("change", sync);
    };
  }, [currency, currencyInputId]);

  return (
    <label className="admin-field" htmlFor={id}>
      <span className="admin-field__label">
        {label}
        {required ? <b aria-hidden="true">*</b> : null}
      </span>

      <span className="admin-money-field">
        <span className="admin-money-field__currency">{displayCurrency}</span>
        <input
          id={id}
          name={name}
          inputMode="decimal"
          defaultValue={defaultValue}
          placeholder={placeholder}
          required={required}
          pattern="^\d+(?:\.\d{1,2})?$"
        />
      </span>

      <small className="admin-field__hint">
        {hint ?? "Enter a major-unit amount with up to 2 decimal places."}
      </small>
    </label>
  );
}
