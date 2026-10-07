"use client";

import { useActionState, type ReactNode } from "react";

export type AdminActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const initialState: AdminActionState = {
  status: "idle",
  message: "",
};

export function AdminActionForm({
  action,
  children,
  className,
}: {
  action: (
    previousState: AdminActionState,
    formData: FormData,
  ) => Promise<AdminActionState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, initialState);

  return (
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
      {children}
    </form>
  );
}
