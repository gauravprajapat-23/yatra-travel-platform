"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

type ResetResponse = {
  error?: { message?: string };
};

export function CustomerResetPasswordForm({
  token,
}: {
  token: string;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");

  const tokenValid = useMemo(
    () => /^[A-Za-z0-9_-]{32,128}$/.test(token),
    [token],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!tokenValid) {
      setError("This reset link is invalid or expired.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 10) {
      setError("Use a password of at least 10 characters.");
      return;
    }

    setPending(true);

    try {
      const response = await fetch("/api/customer-auth/password-reset/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const result = (await response.json()) as ResetResponse;

      if (!response.ok) {
        throw new Error(
          result.error?.message ?? "Unable to reset this password.",
        );
      }

      setComplete(true);
      setPassword("");
      setConfirmPassword("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to reset this password.",
      );
    } finally {
      setPending(false);
    }
  }

  if (complete) {
    return (
      <div className="customer-auth-card">
        <span className="eyebrow">PASSWORD RECOVERY</span>
        <h1>Password updated.</h1>
        <p className="lead-form-success" role="status">
          Your password has been reset. All previous account sessions were
          revoked for your security.
        </p>
        <Link className="button-link button-link--primary" href="/account/login">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <form className="customer-auth-card" onSubmit={submit}>
      <span className="eyebrow">PASSWORD RECOVERY</span>
      <h1>Choose a new password.</h1>
      <p>This one-time link can be used only once.</p>

      <label htmlFor="customerNewPassword">New password</label>
      <div className="customer-auth-password">
        <input
          id="customerNewPassword"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={10}
          required
        />
        <button
          type="button"
          onClick={() => setShowPassword((value) => !value)}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? "Hide" : "Show"}
        </button>
      </div>

      <label htmlFor="customerConfirmPassword">Confirm new password</label>
      <input
        id="customerConfirmPassword"
        type={showPassword ? "text" : "password"}
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        minLength={10}
        required
      />

      {error ? (
        <p className="lead-form-error" role="alert">
          {error}
        </p>
      ) : null}

      <button
        className="button-link button-link--primary"
        type="submit"
        disabled={pending || !tokenValid}
      >
        {pending ? "Resetting…" : "Reset Password"}
      </button>

      {!tokenValid ? (
        <p className="lead-form-error" role="alert">
          This reset link is invalid or expired.
        </p>
      ) : null}

      <small>
        Need another link? <Link href="/account/forgot-password">Request one</Link>
      </small>
    </form>
  );
}
