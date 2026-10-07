import Link from "next/link";
import type { FormHTMLAttributes, ReactNode } from "react";
import { AdminSubmitButton } from "@/components/admin-submit-button";

type AdminFormProps = FormHTMLAttributes<HTMLFormElement> & {
  children: ReactNode;
  aside?: ReactNode;
};

export function AdminForm({
  children,
  aside,
  className = "",
  ...props
}: AdminFormProps) {
  return (
    <div className={aside ? "admin-form-layout" : "admin-form-layout admin-form-layout--single"}>
      <form className={`admin-form ${className}`.trim()} {...props}>
        {children}
      </form>
      {aside ? <aside className="admin-form-aside">{aside}</aside> : null}
    </div>
  );
}

export function AdminFormSection({
  title,
  description,
  badge,
  children,
}: {
  title: string;
  description?: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <section className="admin-form-section">
      <header className="admin-form-section__header">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {badge ? <span className="admin-form-section__badge">{badge}</span> : null}
      </header>
      <div className="admin-form-section__body">{children}</div>
    </section>
  );
}

export function AdminFormGrid({
  columns = 2,
  children,
}: {
  columns?: 1 | 2 | 3;
  children: ReactNode;
}) {
  return (
    <div className={`admin-form-grid admin-form-grid--${columns}`}>
      {children}
    </div>
  );
}

export function AdminField({
  label,
  htmlFor,
  hint,
  required,
  wide,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  required?: boolean;
  wide?: boolean;
  error?: string;
  children: ReactNode;
}) {
  const className = [
    "admin-field",
    wide ? "admin-field--wide" : "",
    error ? "admin-field--error" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <label
      className={className}
      htmlFor={htmlFor}
    >
      <span className="admin-field__label">
        {label}
        {required ? <b aria-hidden="true">*</b> : null}
      </span>
      {children}
      {error ? (
        <small
          className="admin-field__error"
          id={htmlFor ? `${htmlFor}-error` : undefined}
          role="alert"
        >
          {error}
        </small>
      ) : hint ? (
        <small className="admin-field__hint">{hint}</small>
      ) : null}
    </label>
  );
}

export function AdminCheckbox({
  name,
  value,
  defaultChecked,
  label,
  description,
}: {
  name: string;
  value?: string;
  defaultChecked?: boolean;
  label: string;
  description?: string;
}) {
  return (
    <label className="admin-checkbox">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
      />
      <span className="admin-checkbox__control" aria-hidden="true" />
      <span>
        <strong>{label}</strong>
        {description ? <small>{description}</small> : null}
      </span>
    </label>
  );
}

export function AdminCheckboxGrid({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="admin-checkbox-grid">{children}</div>;
}

export function AdminFormCallout({
  title,
  children,
  tone = "info",
}: {
  title?: string;
  children: ReactNode;
  tone?: "info" | "warning" | "success";
}) {
  return (
    <div className={`admin-form-callout admin-form-callout--${tone}`}>
      <span aria-hidden="true">i</span>
      <div>
        {title ? <strong>{title}</strong> : null}
        <p>{children}</p>
      </div>
    </div>
  );
}

export function AdminFormAsideCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="admin-form-aside-card">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export function AdminFormActions({
  submitLabel,
  cancelHref,
  helper,
  danger,
}: {
  submitLabel: string;
  cancelHref: string;
  helper?: string;
  danger?: ReactNode;
}) {
  return (
    <footer className="admin-form-actions">
      <div className="admin-form-actions__meta">
        {danger}
        {helper ? <small>{helper}</small> : null}
      </div>
      <div className="admin-form-actions__buttons">
        <Link className="admin-secondary-button" href={cancelHref}>
          Cancel
        </Link>
        <AdminSubmitButton
          label={submitLabel}
          pendingLabel="Saving…"
        />
      </div>
    </footer>
  );
}
