import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_OPEN_ENDED_TRIP_MS,
  bookingTimeWindow,
  credentialValidThrough,
  windowsOverlap,
} from "./availability";

test("bookingTimeWindow uses a 12-hour fallback when no end is supplied", () => {
  const startsAt = new Date("2026-10-07T10:00:00.000Z");
  const window = bookingTimeWindow(startsAt, null);

  assert.equal(
    window.endsAt.getTime() - window.startsAt.getTime(),
    DEFAULT_OPEN_ENDED_TRIP_MS,
  );
});

test("credential may expire exactly at the required end boundary", () => {
  const requiredUntil = new Date("2026-10-08T10:00:00.000Z");

  assert.equal(
    credentialValidThrough(
      new Date("2026-10-08T10:00:00.000Z"),
      requiredUntil,
    ),
    true,
  );
});

test("credential expiring before trip end is rejected", () => {
  const requiredUntil = new Date("2026-10-08T10:00:00.000Z");

  assert.equal(
    credentialValidThrough(
      new Date("2026-10-08T09:59:59.999Z"),
      requiredUntil,
    ),
    false,
  );
});

test("missing credential expiry is treated as unrestricted", () => {
  assert.equal(
    credentialValidThrough(
      null,
      new Date("2026-10-08T10:00:00.000Z"),
    ),
    true,
  );
});

test("touching windows do not overlap but intersecting windows do", () => {
  const first = {
    startsAt: new Date("2026-10-07T10:00:00.000Z"),
    endsAt: new Date("2026-10-07T12:00:00.000Z"),
  };

  assert.equal(
    windowsOverlap(first, {
      startsAt: new Date("2026-10-07T12:00:00.000Z"),
      endsAt: new Date("2026-10-07T14:00:00.000Z"),
    }),
    false,
  );

  assert.equal(
    windowsOverlap(first, {
      startsAt: new Date("2026-10-07T11:59:59.999Z"),
      endsAt: new Date("2026-10-07T14:00:00.000Z"),
    }),
    true,
  );
});
