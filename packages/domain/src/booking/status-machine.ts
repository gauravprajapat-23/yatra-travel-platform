export const bookingStatuses = [
  "DRAFT",
  "PENDING_PAYMENT",
  "PENDING_REVIEW",
  "CONFIRMED",
  "DRIVER_ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
  "FAILED",
  "REFUND_PENDING",
  "REFUNDED",
] as const;

export type BookingStatus = (typeof bookingStatuses)[number];

const transitions: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  DRAFT: ["PENDING_PAYMENT", "PENDING_REVIEW", "CANCELLED", "EXPIRED"],
  PENDING_PAYMENT: ["CONFIRMED", "PENDING_REVIEW", "FAILED", "CANCELLED", "EXPIRED"],
  PENDING_REVIEW: ["PENDING_PAYMENT", "CONFIRMED", "FAILED", "CANCELLED", "EXPIRED"],
  CONFIRMED: ["DRIVER_ASSIGNED", "CANCELLED", "REFUND_PENDING"],
  DRIVER_ASSIGNED: ["IN_PROGRESS", "CANCELLED", "REFUND_PENDING"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: ["REFUND_PENDING"],
  CANCELLED: ["REFUND_PENDING"],
  EXPIRED: [],
  FAILED: [],
  REFUND_PENDING: ["REFUNDED"],
  REFUNDED: [],
};

export function canTransitionBooking(
  from: BookingStatus,
  to: BookingStatus,
): boolean {
  return transitions[from].includes(to);
}

export function assertBookingTransition(
  from: BookingStatus,
  to: BookingStatus,
): void {
  if (!canTransitionBooking(from, to)) {
    throw new Error(`Invalid booking transition: ${from} -> ${to}`);
  }
}
