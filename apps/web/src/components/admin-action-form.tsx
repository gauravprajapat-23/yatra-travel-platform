"use client";

import { useActionState, type ReactNode } from "react";

export type AdminActionState = {
  status: "idle" | "success" | "error";
  message: string;
  details?: {
    label: string;
    value: string;
  };
};

const initialState: AdminActionState = {
  status: "idle",
  message: "",
};

export function AdminActionForm({
  action,
  children,
  className,
  aside,
}: {
  action: (
    previousState: AdminActionState,
    formData: FormData,
  ) => Promise<AdminActionState>;
  children: ReactNode;
  className?: string;
  aside?: ReactNode;
}) {
  const [state, formAction] = useActionState(action, initialState);

  async function copyDetails() {
    if (!state.details?.value) return;
    await navigator.clipboard.writeText(state.details.value);
  }

  const form = (
    <form action={formAction} className={className}>
      {state.status !== "idle" && state.message ? (
        <div
          className={
            state.status === "error"
              ? "admin-action-feedback admin-action-feedback--error"
              : "admin-action-feedback admin-action-feedback--success"
          }
          role={state.status === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {state.message}
        </div>
      ) : null}

      {state.status === "success" && state.details ? (
        <div className="admin-action-details">
          <label>
            <span>{state.details.label}</span>
            <input
              readOnly
              value={state.details.value}
              onFocus={(event) => event.currentTarget.select()}
              aria-label={state.details.label}
            />
          </label>
          <button
            className="admin-secondary-button"
            type="button"
            onClick={copyDetails}
          >
            Copy
          </button>
        </div>
      ) : null}

      {children}
    </form>
  );

  if (!aside) return form;

  return (
    <div className="admin-form-layout">
      {form}
      <aside className="admin-form-aside">{aside}</aside>
    </div>
  );
}
