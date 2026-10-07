export type TimeWindow = {
  startsAt: Date;
  endsAt: Date;
};

export function assertValidWindow(window: TimeWindow): void {
  if (!(window.startsAt instanceof Date) || !(window.endsAt instanceof Date)) {
    throw new Error("Availability window requires valid dates.");
  }

  if (Number.isNaN(window.startsAt.getTime()) || Number.isNaN(window.endsAt.getTime())) {
    throw new Error("Availability window contains an invalid date.");
  }

  if (window.startsAt >= window.endsAt) {
    throw new Error("Availability window start must be before end.");
  }
}

export function windowsOverlap(a: TimeWindow, b: TimeWindow): boolean {
  assertValidWindow(a);
  assertValidWindow(b);

  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}


export const DEFAULT_OPEN_ENDED_TRIP_MS = 12 * 60 * 60 * 1000;

export function bookingTimeWindow(
  startsAt: Date,
  endsAt: Date | null,
): TimeWindow {
  const window = {
    startsAt,
    endsAt:
      endsAt ??
      new Date(startsAt.getTime() + DEFAULT_OPEN_ENDED_TRIP_MS),
  };

  assertValidWindow(window);
  return window;
}

export function credentialValidThrough(
  expiresAt: Date | null,
  requiredUntil: Date,
): boolean {
  if (!expiresAt) return true;
  if (
    !(requiredUntil instanceof Date) ||
    Number.isNaN(requiredUntil.getTime()) ||
    Number.isNaN(expiresAt.getTime())
  ) {
    return false;
  }

  return expiresAt >= requiredUntil;
}
