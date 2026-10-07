"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminField } from "@/components/admin-form";

type LoginResponse = {
  error?: string;
  code?: string;
};

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);

    try {
      const response = await fetch("/api/admin-auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const contentType = response.headers.get("content-type") ?? "";
      let result: LoginResponse = {};

      if (contentType.includes("application/json")) {
        result = (await response.json()) as LoginResponse;
      } else {
        await response.text();
      }

      if (!response.ok) {
        if (result.code === "AUTH_DATABASE_URL_MISSING") {
          setError("Admin database is not configured in Vercel. Add DATABASE_URL to the Vercel Production environment and redeploy.");
        } else if (result.code === "AUTH_DATABASE_UNAVAILABLE") {
          setError("Admin database is unavailable. Check the Vercel DATABASE_URL value and Neon connection, then redeploy.");
        } else {
          setError(result.error ?? `Sign in failed (HTTP ${response.status}).`);
        }
        return;
      }

      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Unable to reach the login service. Please check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="admin-login-form" onSubmit={submit}>
      <h2>Welcome Back</h2>
      <p>Sign in to your YATRA admin account to continue.</p>

      <AdminField label="Email Address" htmlFor="adminEmail" required>
        <input
          id="adminEmail"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          placeholder="admin@example.com"
          required
        />
      </AdminField>

      <AdminField label="Password" htmlFor="adminPassword" required>
        <div className="admin-login-password">
          <input
            id="adminPassword"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
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
      </AdminField>

      <div className="admin-login-options">
        <span>Secure admin access</span>
        <span>Sessions expire automatically.</span>
      </div>

      {error ? <p className="admin-login-error" role="alert">{error}</p> : null}

      <button className="admin-primary-button admin-login-submit" type="submit" disabled={pending}>
        {pending ? "Signing In…" : "Sign In →"}
      </button>

      <small>Secure. Reliable. Always on the move.</small>
    </form>
  );
}
