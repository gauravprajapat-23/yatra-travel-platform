"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type RequestResponse = {
  message?: string;
  error?: { message?: string };
};

export function CustomerForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/customer-auth/password-reset/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = (await response.json()) as RequestResponse;

      if (!response.ok) {
        throw new Error(
          result.error?.message ?? "Unable to request a reset link.",
        );
      }

      setMessage(
        result.message ??
          "If a verified account exists for that email, a reset link will be sent.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to request a reset link.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="customer-auth-card" onSubmit={submit}>
      <span className="eyebrow">PASSWORD RECOVERY</span>
      <h1>Reset your password.</h1>
      <p>
        Enter your verified account email. For privacy, the response is the same
        whether or not an account exists.
      </p>

      <label htmlFor="customerResetEmail">Email address</label>
      <input
        id="customerResetEmail"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />

      {message ? (
        <p className="lead-form-success" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="lead-form-error" role="alert">
          {error}
        </p>
      ) : null}

      <button
        className="button-link button-link--primary"
        type="submit"
        disabled={pending}
      >
        {pending ? "Requesting…" : "Send Reset Link"}
      </button>

      <small>
        Remembered your password? <Link href="/account/login">Sign in</Link>
      </small>
    </form>
  );
}
