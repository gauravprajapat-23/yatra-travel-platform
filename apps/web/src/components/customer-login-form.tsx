"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type LoginResponse = {
  error?: { message?: string };
};

export function CustomerLoginForm() {
  const router = useRouter();
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [showPassword,setShowPassword]=useState(false);
  const [pending,setPending]=useState(false);
  const [error,setError]=useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      const response=await fetch("/api/customer-auth/login",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({email,password}),
      });
      const result=await response.json() as LoginResponse;
      if(!response.ok) {
        throw new Error(result.error?.message ?? "Unable to sign in.");
      }
      router.replace("/my-trips");
      router.refresh();
    } catch(caught) {
      setError(caught instanceof Error?caught.message:"Unable to sign in.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="customer-auth-card" onSubmit={submit}>
      <span className="eyebrow">CUSTOMER ACCOUNT</span>
      <h1>Welcome back.</h1>
      <p>Sign in to see bookings linked securely to your YATRA account.</p>

      <label htmlFor="customerEmail">Email address</label>
      <input
        id="customerEmail"
        type="email"
        autoComplete="username"
        value={email}
        onChange={(event)=>setEmail(event.target.value)}
        required
      />

      <label htmlFor="customerPassword">Password</label>
      <div className="customer-auth-password">
        <input
          id="customerPassword"
          type={showPassword?"text":"password"}
          autoComplete="current-password"
          value={password}
          onChange={(event)=>setPassword(event.target.value)}
          required
        />
        <button
          type="button"
          onClick={()=>setShowPassword((value)=>!value)}
          aria-label={showPassword?"Hide password":"Show password"}
        >
          {showPassword?"Hide":"Show"}
        </button>
      </div>

      {error?<p className="lead-form-error" role="alert">{error}</p>:null}

      <button className="button-link button-link--primary" type="submit" disabled={pending}>
        {pending?"Signing in…":"Sign In"}
      </button>

      <small>
        New to YATRA? <Link href="/account/register">Create an account</Link>
      </small>
      <small>
        Have a guest booking? <Link href="/my-trips">Use booking lookup</Link>
      </small>
    </form>
  );
}
