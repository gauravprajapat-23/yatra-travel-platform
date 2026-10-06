"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RazorpaySuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpaySuccess) => void | Promise<void>;
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
};

type RazorpayInstance = {
  open: () => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Unable to load Razorpay Checkout.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load Razorpay Checkout."));
    document.head.appendChild(script);
  });
}

function key(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `pay-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function RazorpayPayment({
  bookingType,
  bookingReference,
  displayAmount,
}: {
  bookingType: "CAR" | "PACKAGE";
  bookingReference: string;
  displayAmount: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function beginPayment() {
    setPending(true);
    setError("");

    try {
      const [configResponse] = await Promise.all([
        fetch("/api/payments/config", { cache: "no-store" }),
        loadRazorpay(),
      ]);

      const config = (await configResponse.json()) as {
        enabled?: boolean;
        keyId?: string;
        error?: string;
      };

      if (!configResponse.ok || !config.enabled || !config.keyId) {
        throw new Error(config.error ?? "Online payment is unavailable.");
      }

      const orderResponse = await fetch("/api/payments/order", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": key(),
        },
        body: JSON.stringify({
          bookingType,
          bookingReference,
        }),
      });

      const order = (await orderResponse.json()) as {
        paymentIntentId?: string;
        providerOrderId?: string | null;
        amountMinor?: string;
        currency?: string;
        error?: { message?: string; code?: string };
      };

      if (
        !orderResponse.ok ||
        !order.paymentIntentId ||
        !order.providerOrderId ||
        !order.amountMinor ||
        !order.currency
      ) {
        throw new Error(
          order.error?.message ?? "Unable to create a secure payment order.",
        );
      }

      if (!window.Razorpay) {
        throw new Error("Razorpay Checkout did not load.");
      }

      const checkout = new window.Razorpay({
        key: config.keyId,
        amount: Number(order.amountMinor),
        currency: order.currency,
        name: "YATRA",
        description: `Booking ${bookingReference}`,
        order_id: order.providerOrderId,
        theme: { color: "#ef6c18" },
        modal: {
          ondismiss: () => {
            setPending(false);
          },
        },
        handler: async (provider) => {
          try {
            const verifyResponse = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                paymentIntentId: order.paymentIntentId,
                razorpay_payment_id: provider.razorpay_payment_id,
                razorpay_signature: provider.razorpay_signature,
              }),
            });

            const verified = (await verifyResponse.json()) as {
              status?: string;
              error?: { message?: string };
            };

            if (!verifyResponse.ok || verified.status !== "CAPTURED") {
              throw new Error(
                verified.error?.message ??
                  "Payment could not be verified. Please check your booking status before retrying.",
              );
            }

            router.replace("/booking/success");
            router.refresh();
          } catch (caught) {
            setError(
              caught instanceof Error
                ? caught.message
                : "Payment verification failed.",
            );
            setPending(false);
          }
        },
      });

      checkout.open();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to start payment.",
      );
      setPending(false);
    }
  }

  return (
    <div className="razorpay-payment-box">
      <strong>{displayAmount}</strong>
      <p>Amount comes from the server booking and cannot be edited here.</p>
      {error ? <p className="payment-flow-error" role="alert">{error}</p> : null}
      <button
        className="button-link button-link--primary"
        type="button"
        onClick={beginPayment}
        disabled={pending}
      >
        {pending ? "Opening Secure Payment…" : "Pay Securely with Razorpay →"}
      </button>
    </div>
  );
}
