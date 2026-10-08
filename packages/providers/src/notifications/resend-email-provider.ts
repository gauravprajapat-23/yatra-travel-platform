import {
  NotificationProviderError,
  type NotificationMessage,
  type NotificationProvider,
  type NotificationSendResult,
} from "./notification-provider";

const API_URL = "https://api.resend.com/emails";
const REQUEST_TIMEOUT_MS = 10_000;

type ResendResponse = {
  id?: unknown;
  message?: unknown;
  name?: unknown;
};

function requiredEnv(name: "RESEND_API_KEY" | "NOTIFICATION_EMAIL_FROM"): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function stringValue(
  message: NotificationMessage,
  key: string,
  maxLength = 4096,
): string {
  const value = message.templateData[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new NotificationProviderError(
      `Notification template field ${key} is required.`,
      false,
      "INVALID_TEMPLATE_DATA",
    );
  }

  return value.trim().slice(0, maxLength);
}

function renderEmail(message: NotificationMessage): {
  subject: string;
  html: string;
} {
  const actionUrl = stringValue(message, "actionUrl", 4096);
  const expiresAt = stringValue(message, "expiresAt", 128);
  const safeUrl = escapeHtml(actionUrl);
  const safeExpiry = escapeHtml(expiresAt);

  if (message.templateKey === "customer-email-verification-v1") {
    return {
      subject: "Verify your Yatra account email",
      html: [
        "<p>Welcome to Yatra.</p>",
        "<p>Verify your email address to activate your customer account:</p>",
        `<p><a href="${safeUrl}">Verify email address</a></p>`,
        `<p>This link expires at ${safeExpiry}.</p>`,
        "<p>If you did not create this account, you can ignore this email.</p>",
      ].join(""),
    };
  }

  if (message.templateKey === "customer-password-reset-v1") {
    return {
      subject: "Reset your Yatra account password",
      html: [
        "<p>We received a request to reset your Yatra account password.</p>",
        `<p><a href="${safeUrl}">Reset password</a></p>`,
        `<p>This link expires at ${safeExpiry}.</p>`,
        "<p>If you did not request this, you can ignore this email.</p>",
      ].join(""),
    };
  }

  throw new NotificationProviderError(
    `Unsupported notification template: ${message.templateKey}`,
    false,
    "UNSUPPORTED_TEMPLATE",
  );
}

export class ResendEmailProvider implements NotificationProvider {
  readonly name = "resend";

  async send(message: NotificationMessage): Promise<NotificationSendResult> {
    if (message.channel !== "EMAIL") {
      throw new NotificationProviderError(
        "ResendEmailProvider only supports EMAIL notifications.",
        false,
        "UNSUPPORTED_CHANNEL",
      );
    }

    const apiKey = requiredEnv("RESEND_API_KEY");
    const from = requiredEnv("NOTIFICATION_EMAIL_FROM");
    const { subject, html } = renderEmail(message);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [message.destination],
          subject,
          html,
        }),
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => ({}))) as ResendResponse;

      if (!response.ok) {
        const detail =
          typeof payload.message === "string"
            ? payload.message.slice(0, 500)
            : `Resend returned HTTP ${response.status}.`;

        throw new NotificationProviderError(
          detail,
          response.status === 429 || response.status >= 500,
          `HTTP_${response.status}`,
        );
      }

      if (typeof payload.id !== "string" || !payload.id.trim()) {
        throw new NotificationProviderError(
          "Resend response did not include a message id.",
          true,
          "INVALID_PROVIDER_RESPONSE",
        );
      }

      return {
        provider: this.name,
        providerMessageId: payload.id.trim().slice(0, 500),
      };
    } catch (error) {
      if (error instanceof NotificationProviderError) throw error;

      if (error instanceof Error && error.name === "AbortError") {
        throw new NotificationProviderError(
          "Resend request timed out.",
          true,
          "TIMEOUT",
        );
      }

      throw new NotificationProviderError(
        error instanceof Error ? error.message : "Resend request failed.",
        true,
        "NETWORK_ERROR",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
