"use client";

import { useFormStatus } from "react-dom";

export function AdminConfirmSubmitButton({
  label,
  pendingLabel,
  confirmMessage,
  className = "admin-danger-button",
}: {
  label: string;
  pendingLabel?: string;
  confirmMessage: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className={className}
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {pending ? pendingLabel ?? "Working…" : label}
    </button>
  );
}
