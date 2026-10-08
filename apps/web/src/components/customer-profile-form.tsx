"use client";

import { FormEvent, useState } from "react";

export function CustomerProfileForm({
  email,
  defaultName,
  defaultPhone,
}: {
  email: string;
  defaultName: string;
  defaultPhone: string;
}) {
  const [name,setName]=useState(defaultName);
  const [phone,setPhone]=useState(defaultPhone);
  const [pending,setPending]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setError("");

    try {
      const response=await fetch("/api/customer/account",{
        method:"PATCH",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({name,phone}),
      });
      const result=await response.json() as {
        error?:{message?:string};
      };
      if(!response.ok) {
        throw new Error(result.error?.message ?? "Unable to update profile.");
      }
      setMessage("Profile updated.");
    } catch(caught) {
      setError(caught instanceof Error?caught.message:"Unable to update profile.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="customer-auth-card" onSubmit={submit}>
      <span className="eyebrow">ACCOUNT SETTINGS</span>
      <h1>Your profile.</h1>
      <p>Your verified email cannot be changed from this screen.</p>

      <label htmlFor="customerProfileEmail">Verified email</label>
      <input id="customerProfileEmail" value={email} readOnly />

      <label htmlFor="customerProfileName">Name</label>
      <input
        id="customerProfileName"
        value={name}
        onChange={(event)=>setName(event.target.value)}
        maxLength={120}
        autoComplete="name"
      />

      <label htmlFor="customerProfilePhone">Phone</label>
      <input
        id="customerProfilePhone"
        value={phone}
        onChange={(event)=>setPhone(event.target.value)}
        maxLength={32}
        autoComplete="tel"
      />

      {error?<p className="lead-form-error" role="alert">{error}</p>:null}
      {message?<p className="lead-form-success" role="status">{message}</p>:null}

      <button className="button-link button-link--primary" type="submit" disabled={pending}>
        {pending?"Saving…":"Save Profile"}
      </button>
    </form>
  );
}
