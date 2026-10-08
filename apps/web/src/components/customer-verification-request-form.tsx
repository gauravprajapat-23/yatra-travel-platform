"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type RequestResponse = {
  message?: string;
  error?: { message?: string };
};

export function CustomerVerificationRequestForm() {
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
      const response = await fetch("/api/customer-auth/verification/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = (await response.json()) as RequestResponse;

      if (!response.ok) {
        throw new Error(
          result.error?.message ?? "Unable to request a verification email.",
        );
      }

      setMessage(
        result.message ??
          "If an unverified customer account exists for that email, a new verification link will be sent.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to request a verification email.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="customer-auth-card" onSubmit={submit}>
      <span className="eyebrow">EMAIL VERIFICATION</span>
      <h1>Send a new verification link.</h1>
      <p>
        Enter the email used for your customer account. For privacy, the
        response is the same whether or not an unverified account exists.
      </p>

      <label htmlFor="customerVerificationEmail">Email address</label>
      <input
        id="customerVerificationEmail"
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
        {pending ? "Requesting…" : "Send Verification Link"}
      </button>

      <small>
        Already verified? <Link href="/account/login">Sign in</Link>
      </small>
    </form>
  );
}
