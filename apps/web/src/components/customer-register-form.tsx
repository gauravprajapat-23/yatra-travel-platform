"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type RegisterResponse = {
  message?: string;
  error?: { message?: string };
};

export function CustomerRegisterForm() {
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [pending,setPending]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");

    try {
      const response=await fetch("/api/customer-auth/register",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({name,email,password}),
      });
      const result=await response.json() as RegisterResponse;
      if(!response.ok) {
        throw new Error(result.error?.message ?? "Unable to create account.");
      }
      setMessage(result.message ?? "Account created. Verification is required before sign-in.");
      setPassword("");
    } catch(caught) {
      setError(caught instanceof Error?caught.message:"Unable to create account.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="customer-auth-card" onSubmit={submit}>
      <span className="eyebrow">CREATE ACCOUNT</span>
      <h1>Your journeys, together.</h1>
      <p>
        Registration remains protected until email verification is available.
        Existing verified customers can sign in now.
      </p>

      <label htmlFor="customerName">Name</label>
      <input
        id="customerName"
        value={name}
        onChange={(event)=>setName(event.target.value)}
        maxLength={120}
      />

      <label htmlFor="customerRegisterEmail">Email address</label>
      <input
        id="customerRegisterEmail"
        type="email"
        autoComplete="username"
        value={email}
        onChange={(event)=>setEmail(event.target.value)}
        required
      />

      <label htmlFor="customerRegisterPassword">Password</label>
      <input
        id="customerRegisterPassword"
        type="password"
        autoComplete="new-password"
        minLength={10}
        maxLength={256}
        value={password}
        onChange={(event)=>setPassword(event.target.value)}
        required
      />

      {error?<p className="lead-form-error" role="alert">{error}</p>:null}
      {message?<p className="lead-form-success" role="status">{message}</p>:null}

      <button className="button-link button-link--primary" type="submit" disabled={pending}>
        {pending?"Creating…":"Create Account"}
      </button>

      <small>
        Already verified? <Link href="/account/login">Sign in</Link>
      </small>
    </form>
  );
}
