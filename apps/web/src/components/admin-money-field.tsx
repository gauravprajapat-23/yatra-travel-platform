"use client";

export function AdminMoneyField({
  name,
  label,
  currency = "INR",
  defaultValue = "",
  placeholder,
  required = false,
  hint,
}: {
  name: string;
  label: string;
  currency?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
}) {
  const id = `admin-money-${name}`;

  return (
    <label className="admin-field" htmlFor={id}>
      <span className="admin-field__label">
        {label}
        {required ? <b aria-hidden="true">*</b> : null}
      </span>

      <span className="admin-money-field">
        <span className="admin-money-field__currency">{currency}</span>
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
