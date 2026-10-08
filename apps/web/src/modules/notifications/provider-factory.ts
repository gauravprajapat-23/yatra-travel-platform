import type { NotificationProvider } from "@yatra/providers/notifications/notification-provider";
import { ResendEmailProvider } from "@yatra/providers/notifications/resend-email-provider";

export function getEmailNotificationProvider(): NotificationProvider {
  const provider = process.env.NOTIFICATION_EMAIL_PROVIDER?.trim().toLowerCase();

  if (provider === "resend") {
    return new ResendEmailProvider();
  }

  throw new Error(
    "No certified email notification provider is configured. Set NOTIFICATION_EMAIL_PROVIDER=resend after provider certification.",
  );
}
