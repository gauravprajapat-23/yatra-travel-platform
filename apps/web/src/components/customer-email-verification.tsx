"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type VerificationState = "verifying" | "success" | "error";

type VerifyResponse = {
  message?: string;
  error?: { message?: string };
};

export function CustomerEmailVerification() {
  const started = useRef(false);
  const [state, setState] = useState<VerificationState>("verifying");
  const [message, setMessage] = useState("Verifying your email…");

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const fragmentParams = new URLSearchParams(
      window.location.hash.replace(/^#/, ""),
    );
    const queryParams = new URLSearchParams(window.location.search);
    const token =
      fragmentParams.get("token")?.trim() ??
      queryParams.get("token")?.trim() ??
      "";

    window.history.replaceState({}, "", window.location.pathname);

    if (!token) {
      const timer = window.setTimeout(() => {
        setState("error");
        setMessage("This verification link is invalid or has expired.");
      }, 0);
      return () => window.clearTimeout(timer);
    }

    void (async () => {
      try {
        const response = await fetch("/api/customer-auth/verify-email", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const result = (await response.json()) as VerifyResponse;

        if (!response.ok) {
          throw new Error(
            result.error?.message ??
              "This verification link is invalid or has expired.",
          );
        }

        setState("success");
        setMessage(result.message ?? "Email verified. You can now sign in.");
      } catch (error) {
        setState("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to verify this email right now.",
        );
      }
    })();
  }, []);

  return (
    <div className="customer-auth-card">
      <span className="eyebrow">EMAIL VERIFICATION</span>
      <h1>
        {state === "verifying"
          ? "Checking your link."
          : state === "success"
            ? "Email verified."
            : "Verification failed."}
      </h1>
      <p
        className={
          state === "success"
            ? "lead-form-success"
            : state === "error"
              ? "lead-form-error"
              : undefined
        }
        role={state === "error" ? "alert" : "status"}
      >
        {message}
      </p>

      {state === "success" ? (
        <Link className="button-link button-link--primary" href="/account/login">
          Sign In
        </Link>
      ) : null}

      {state === "error" ? (
        <small>
          Need a new verification message? Return to{" "}
          <Link href="/account/register">account registration</Link>.
        </small>
      ) : null}
    </div>
  );
}
