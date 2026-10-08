export type NotificationChannel = "EMAIL" | "SMS" | "WHATSAPP";

export type NotificationPurpose =
  | "CUSTOMER_EMAIL_VERIFICATION"
  | "CUSTOMER_PASSWORD_RESET";

export type NotificationTemplateData = Readonly<Record<string, string | number | boolean | null>>;

export type NotificationMessage = {
  channel: NotificationChannel;
  purpose: NotificationPurpose;
  destination: string;
  templateKey: string;
  templateData: NotificationTemplateData;
};

export type NotificationSendResult = {
  provider: string;
  providerMessageId?: string | null;
};

export interface NotificationProvider {
  readonly name: string;
  send(message: NotificationMessage): Promise<NotificationSendResult>;
}

export class NotificationProviderError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "NotificationProviderError";
  }
}
