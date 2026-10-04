export type RazorpayOrder = {
  id: string;
  entity: "order";
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string | null;
  status: string;
};

export type RazorpayPayment = {
  id: string;
  entity: "payment";
  amount: number;
  currency: string;
  status: string;
  order_id: string | null;
  captured: boolean;
};

export type RazorpayRefund = {
  id: string;
  entity: "refund";
  amount: number;
  currency: string;
  payment_id: string;
  status: string;
};

export class RazorpayApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "RazorpayApiError";
  }
}

function credentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Razorpay API credentials are not configured.");
  }

  return { keyId, keySecret };
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { keyId, keySecret } = credentials();
  const authorization = Buffer.from(`${keyId}:${keySecret}`).toString(
    "base64",
  );

  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const body = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new RazorpayApiError(
      `Razorpay API request failed with HTTP ${response.status}.`,
      response.status,
      body,
    );
  }

  return body as T;
}

function toProviderAmount(amountMinor: bigint): number {
  if (amountMinor < 0n || amountMinor > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Payment amount is outside supported provider range.");
  }

  return Number(amountMinor);
}

export async function createRazorpayOrder(input: {
  amountMinor: bigint;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  return request<RazorpayOrder>("/orders", {
    method: "POST",
    body: JSON.stringify({
      amount: toProviderAmount(input.amountMinor),
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes ?? {},
    }),
  });
}

export async function fetchRazorpayPayment(
  paymentId: string,
): Promise<RazorpayPayment> {
  return request<RazorpayPayment>(
    `/payments/${encodeURIComponent(paymentId)}`,
  );
}

export async function createRazorpayRefund(input: {
  paymentId: string;
  amountMinor: bigint;
  notes?: Record<string, string>;
}): Promise<RazorpayRefund> {
  return request<RazorpayRefund>(
    `/payments/${encodeURIComponent(input.paymentId)}/refund`,
    {
      method: "POST",
      body: JSON.stringify({
        amount: toProviderAmount(input.amountMinor),
        notes: input.notes ?? {},
      }),
    },
  );
}
