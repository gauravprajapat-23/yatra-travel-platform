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
