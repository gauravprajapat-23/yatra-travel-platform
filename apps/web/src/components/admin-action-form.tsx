"use client";

import { AdminFormDirtyGuard } from "@/components/admin-form-dirty-guard";
import {
  useActionState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

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
  const feedbackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (state.status === "idle" || !state.message) return;

    const feedback = feedbackRef.current;
    if (!feedback) return;

    feedback.focus({ preventScroll: true });

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    feedback.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "center",
    });
  }, [state.status, state.message]);

  async function copyDetails() {
    if (!state.details?.value) return;
    await navigator.clipboard.writeText(state.details.value);
  }

  const form = (
    <form action={formAction} className={className}>
      <AdminFormDirtyGuard />
      {state.status !== "idle" && state.message ? (
        <div
          ref={feedbackRef}
          tabIndex={-1}
          className={
            state.status === "error"
              ? "admin-action-feedback admin-action-feedback--error"
              : "admin-action-feedback admin-action-feedback--success"
          }
          role={state.status === "error" ? "alert" : "status"}
          aria-live="polite"
          aria-atomic="true"
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
