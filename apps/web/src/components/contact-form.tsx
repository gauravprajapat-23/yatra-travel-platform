"use client";

import { FormEvent, useState } from "react";

function key(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `lead-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function ContactForm() {
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [phone,setPhone]=useState("");
  const [travelDate,setTravelDate]=useState("");
  const [message,setMessage]=useState("");
  const [website,setWebsite]=useState("");
  const [pending,setPending]=useState(false);
  const [status,setStatus]=useState<{kind:"idle"|"success"|"error";message:string}>({kind:"idle",message:""});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({kind:"idle",message:""});

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    const trimmedMessage = message.trim();

    if (trimmedName.length < 2 || trimmedName.length > 120) {
      setStatus({kind:"error",message:"Please enter your full name."});
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setStatus({kind:"error",message:"Please enter a valid email address."});
      return;
    }
    if (trimmedPhone && !/^[+()\d\s-]{7,40}$/.test(trimmedPhone)) {
      setStatus({kind:"error",message:"Please enter a valid phone number."});
      return;
    }
    if (!trimmedMessage) {
      setStatus({kind:"error",message:"Please enter a message."});
      return;
    }
    if (travelDate) {
      const today = new Date();
      today.setHours(0,0,0,0);
      const selected = new Date(`${travelDate}T00:00:00`);
      if (selected < today) {
        setStatus({kind:"error",message:"Preferred travel date cannot be in the past."});
        return;
      }
    }

    setPending(true);

    try {
      const response=await fetch("/api/leads",{
        method:"POST",
        headers:{"content-type":"application/json","Idempotency-Key":key()},
        body:JSON.stringify({
          type:"CONTACT",
          name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone,
          message: travelDate ? `Preferred travel date: ${travelDate}\n\n${trimmedMessage}` : trimmedMessage,
          sourcePath:"/contact",
          website,
        }),
      });
      const result=await response.json() as {reference?:string;error?:{message?:string}};
      if(!response.ok) throw new Error(result.error?.message ?? "Unable to send your message.");

      setStatus({kind:"success",message:`Thanks — your request ${result.reference ?? ""} has been received.`});
      setName(""); setEmail(""); setPhone(""); setTravelDate(""); setMessage("");
    } catch (caught) {
      setStatus({kind:"error",message:caught instanceof Error?caught.message:"Unable to send your message."});
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="contact-form" onSubmit={submit}>
      <p className="eyebrow">SEND US A MESSAGE</p>
      <h2>Tell us about your travel plans.</h2>
      <div className="form-grid">
        <label>Full Name<input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" minLength={2} maxLength={120} required /></label>
        <label>Email Address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" maxLength={254} required /></label>
        <label>Phone Number<input type="tel" inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} autoComplete="tel" maxLength={40} placeholder="+91" /></label>
        <label>Preferred Travel Date<input type="date" value={travelDate} onChange={e=>setTravelDate(e.target.value)} /></label>
      </div>

      <label className="lead-honeypot" aria-hidden="true">
        Website
        <input tabIndex={-1} autoComplete="off" value={website} onChange={e=>setWebsite(e.target.value)} />
      </label>

      <label>Your Message<textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="Tell us about your travel plans..." required maxLength={2000} /></label>

      {status.kind!=="idle"?<p className={status.kind==="success"?"lead-form-success":"lead-form-error"} role="status">{status.message}</p>:null}

      <button className="button-link button-link--primary" type="submit" disabled={pending}>
        {pending?"Sending…":"Send Message →"}
      </button>
    </form>
  );
}
