"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

type Consent = "analytics" | "essential" | null;
const STORAGE_KEY = "yatra-cookie-consent-v1";

export function ConsentAnalytics({ measurementId }: { measurementId?: string }) {
  const [consent, setConsent] = useState<Consent>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "analytics" || stored === "essential") {
      setConsent(stored);
    }
    setReady(true);
  }, []);

  function choose(value: Exclude<Consent, null>) {
    window.localStorage.setItem(STORAGE_KEY, value);
    setConsent(value);
  }

  return (
    <>
      {measurementId && consent === "analytics" ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
            strategy="afterInteractive"
          />
          <Script id="yatra-google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${measurementId.replaceAll("'", "")}', {
                anonymize_ip: true,
                allow_google_signals: false,
                allow_ad_personalization_signals: false
              });
            `}
          </Script>
        </>
      ) : null}

      {ready && consent === null ? (
        <section
          className="cookie-consent"
          aria-label="Cookie preferences"
          aria-live="polite"
        >
          <div>
            <strong>Privacy choices</strong>
            <p>
              YATRA uses essential browser storage for core site functions.
              Optional analytics helps us understand site usage and only loads
              after you accept it.
            </p>
          </div>
          <div className="cookie-consent__actions">
            <button
              className="button-link button-link--ghost"
              type="button"
              onClick={() => choose("essential")}
            >
              Essential only
            </button>
            <button
              className="button-link button-link--primary"
              type="button"
              onClick={() => choose("analytics")}
            >
              Accept analytics
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
