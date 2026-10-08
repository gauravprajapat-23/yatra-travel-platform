import type { NotificationProvider } from "@yatra/providers/notifications/notification-provider";
import {
  issueAuthActionToken,
  revokeAuthActionTokens,
} from "./auth-action-service";
import { deliverNotification } from "./notification-delivery-service";

type AuthNotificationPurpose = "EMAIL_VERIFICATION" | "PASSWORD_RESET";

function appOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) throw new Error("NEXT_PUBLIC_APP_URL is required.");

  const url = new URL(raw);
  return url.origin;
}

function notificationConfig(purpose: AuthNotificationPurpose) {
  if (purpose === "EMAIL_VERIFICATION") {
    return {
      deliveryPurpose: "CUSTOMER_EMAIL_VERIFICATION" as const,
      templateKey: "customer-email-verification-v1",
      path: "/account/verify-email",
      tokenParam: "token",
    };
  }

  return {
    deliveryPurpose: "CUSTOMER_PASSWORD_RESET" as const,
    templateKey: "customer-password-reset-v1",
    path: "/account/reset-password",
    tokenParam: "token",
  };
}

export async function sendAuthActionNotification(input: {
  userId: string;
  destinationEmail: string;
  purpose: AuthNotificationPurpose;
  provider: NotificationProvider;
}) {
  const email = input.destinationEmail.trim().toLowerCase();
  if (!email || email.length > 320) {
    throw new Error("A valid destination email is required.");
  }

  const config = notificationConfig(input.purpose);
  const token = await issueAuthActionToken({
    userId: input.userId,
    purpose: input.purpose,
  });

  const url = new URL(config.path, appOrigin());
  url.searchParams.set(config.tokenParam, token.rawToken);

  try {
    const delivery = await deliverNotification({
      userId: input.userId,
      provider: input.provider,
      message: {
        channel: "EMAIL",
        purpose: config.deliveryPurpose,
        destination: email,
        templateKey: config.templateKey,
        templateData: {
          actionUrl: url.toString(),
          expiresAt: token.expiresAt.toISOString(),
        },
      },
    });

    return {
      tokenId: token.id,
      expiresAt: token.expiresAt,
      deliveryId: delivery.deliveryId,
      status: delivery.status,
    };
  } catch (error) {
    await revokeAuthActionTokens({
      userId: input.userId,
      purpose: input.purpose,
    }).catch(() => undefined);
    throw error;
  }
}
