import { getDb } from "@yatra/db/client";
import type {
  NotificationMessage,
  NotificationProvider,
} from "@yatra/providers/notifications/notification-provider";

function boundedError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown notification provider error.";
  return message.slice(0, 1000);
}

export async function deliverNotification(input: {
  userId?: string | null;
  message: NotificationMessage;
  provider: NotificationProvider;
}) {
  const db = getDb();

  const delivery = await db.notificationDelivery.create({
    data: {
      userId: input.userId ?? null,
      channel: input.message.channel,
      purpose: input.message.purpose,
      destination: input.message.destination,
      templateKey: input.message.templateKey,
      status: "PENDING",
    },
    select: { id: true },
  });

  const claimed = await db.notificationDelivery.updateMany({
    where: {
      id: delivery.id,
      status: "PENDING",
    },
    data: {
      status: "PROCESSING",
      attemptCount: { increment: 1 },
      provider: input.provider.name,
      lastError: null,
      failedAt: null,
    },
  });

  if (claimed.count !== 1) {
    throw new Error("Notification delivery could not be claimed.");
  }

  try {
    const result = await input.provider.send(input.message);

    await db.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "SENT",
        provider: result.provider || input.provider.name,
        providerMessageId: result.providerMessageId ?? null,
        sentAt: new Date(),
        failedAt: null,
        lastError: null,
      },
    });

    return {
      deliveryId: delivery.id,
      status: "SENT" as const,
      provider: result.provider || input.provider.name,
      providerMessageId: result.providerMessageId ?? null,
    };
  } catch (error) {
    await db.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        lastError: boundedError(error),
      },
    });

    throw error;
  }
}
