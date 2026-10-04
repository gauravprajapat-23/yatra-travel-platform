export type BookingCustomerIdentity =
  | {
      customerUserId: string;
      guestName?: never;
      guestEmail?: never;
    }
  | {
      customerUserId?: null;
      guestName: string;
      guestEmail: string;
    };

export function assertBookingCustomerIdentity(
  identity: BookingCustomerIdentity,
): void {
  if (identity.customerUserId) {
    return;
  }

  if (!identity.guestName?.trim() || !identity.guestEmail?.trim()) {
    throw new Error(
      "Guest booking requires a non-empty name and email address.",
    );
  }
}
