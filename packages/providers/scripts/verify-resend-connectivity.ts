import { ResendEmailProvider } from "../src/notifications/resend-email-provider";

const provider = new ResendEmailProvider();

const result = await provider.send({
  channel: "EMAIL",
  purpose: "CUSTOMER_EMAIL_VERIFICATION",
  destination: "delivered@resend.dev",
  templateKey: "customer-email-verification-v1",
  templateData: {
    actionUrl: "https://example.com/yatra-resend-connectivity-check",
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  },
});

console.log("Resend connectivity verification passed.");
console.log(
  JSON.stringify(
    {
      provider: result.provider,
      providerMessageId: result.providerMessageId ?? null,
      testRecipient: "delivered@resend.dev",
    },
    null,
    2,
  ),
);
