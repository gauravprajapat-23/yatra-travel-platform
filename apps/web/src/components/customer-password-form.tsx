"use client";

import { FormEvent, useState } from "react";

export function CustomerPasswordForm() {
  const [currentPassword,setCurrentPassword]=useState("");
  const [newPassword,setNewPassword]=useState("");
  const [pending,setPending]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setError("");

    try {
      const response=await fetch("/api/customer/account/password",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({currentPassword,newPassword}),
      });
      const result=await response.json() as {
        message?:string;
        error?:{message?:string};
      };
      if(!response.ok) {
        throw new Error(result.error?.message ?? "Unable to change password.");
      }
      setCurrentPassword("");
      setNewPassword("");
      setMessage(result.message ?? "Password updated.");
    } catch(caught) {
      setError(caught instanceof Error?caught.message:"Unable to change password.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="customer-auth-card" onSubmit={submit}>
      <span className="eyebrow">SECURITY</span>
      <h2>Change password</h2>
      <p>Changing your password signs out your other active sessions.</p>

      <label htmlFor="customerCurrentPassword">Current password</label>
      <input
        id="customerCurrentPassword"
        type="password"
        autoComplete="current-password"
        maxLength={256}
        value={currentPassword}
        onChange={(event)=>setCurrentPassword(event.target.value)}
        required
      />

      <label htmlFor="customerNewPassword">New password</label>
      <input
        id="customerNewPassword"
        type="password"
        autoComplete="new-password"
        minLength={10}
        maxLength={256}
        value={newPassword}
        onChange={(event)=>setNewPassword(event.target.value)}
        required
      />

      {error?<p className="lead-form-error" role="alert">{error}</p>:null}
      {message?<p className="lead-form-success" role="status">{message}</p>:null}

      <button className="button-link button-link--primary" type="submit" disabled={pending}>
        {pending?"Updating…":"Change Password"}
      </button>
    </form>
  );
}
