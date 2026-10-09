import "dotenv/config";
import assert from "node:assert/strict";
import { getDb } from "@yatra/db/client";
import {
  cancelVehicleMaintenance,
  completeVehicleMaintenance,
  scheduleVehicleMaintenance,
  startVehicleMaintenance,
} from "../src/modules/fleet/fleet-management-service";

async function main() {
  const db = getDb();
  const vehicleId = "e2e_assignment_maintenance_vehicle";
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  if (!adminEmail) throw new Error("ADMIN_EMAIL is required.");

  const actor = await db.user.findUnique({
    where: { emailNormalized: adminEmail },
    select: { id: true },
  });
  if (!actor) throw new Error("Disposable CI admin was not found.");

  const oldRecords = await db.vehicleMaintenanceRecord.findMany({
    where: { vehicleId },
    select: { id: true, availabilityBlockId: true },
  });

  await db.vehicleMaintenanceRecord.deleteMany({ where: { vehicleId } });
  await db.vehicleAvailabilityBlock.deleteMany({
    where: {
      vehicleId,
      id: {
        in: oldRecords
          .map((item) => item.availabilityBlockId)
          .filter((value): value is string => Boolean(value)),
      },
    },
  });

  const startsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const endsAt = new Date(startsAt.getTime() + 4 * 60 * 60 * 1000);

  const scheduled = await scheduleVehicleMaintenance({
    vehicleId,
    category: "Periodic service",
    summary: "E2E oil and filter replacement",
    startsAt,
    endsAt,
    odometerKm: 42000,
    costMinor: 250000n,
    currency: "INR",
    vendor: "E2E Service Center",
    notes: "Disposable maintenance lifecycle verification.",
    actorUserId: actor.id,
  });

  assert.equal(scheduled.status, "SCHEDULED");
  assert.ok(scheduled.availabilityBlockId);

  const scheduledBlock = await db.vehicleAvailabilityBlock.findUnique({
    where: { id: scheduled.availabilityBlockId! },
  });
  assert.ok(scheduledBlock);
  assert.equal(scheduledBlock.vehicleId, vehicleId);

  const started = await startVehicleMaintenance({
    vehicleId,
    maintenanceId: scheduled.id,
    actorUserId: actor.id,
  });
  assert.equal(started.status, "IN_PROGRESS");

  const startedBlock = await db.vehicleAvailabilityBlock.findUnique({
    where: { id: scheduled.availabilityBlockId! },
  });
  assert.ok(startedBlock);

  const completed = await completeVehicleMaintenance({
    vehicleId,
    maintenanceId: scheduled.id,
    actorUserId: actor.id,
  });
  assert.equal(completed.status, "COMPLETED");
  assert.ok(completed.completedAt);
  assert.equal(completed.availabilityBlockId, null);

  const completedBlock = await db.vehicleAvailabilityBlock.findUnique({
    where: { id: scheduled.availabilityBlockId! },
  });
  assert.equal(completedBlock, null);

  const cancelStartsAt = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
  const cancelEndsAt = new Date(
    cancelStartsAt.getTime() + 3 * 60 * 60 * 1000,
  );

  const cancellable = await scheduleVehicleMaintenance({
    vehicleId,
    category: "Inspection",
    summary: "E2E pre-trip inspection",
    startsAt: cancelStartsAt,
    endsAt: cancelEndsAt,
    odometerKm: null,
    costMinor: null,
    currency: "INR",
    vendor: "",
    notes: "",
    actorUserId: actor.id,
  });

  assert.ok(cancellable.availabilityBlockId);

  const cancelled = await cancelVehicleMaintenance({
    vehicleId,
    maintenanceId: cancellable.id,
    actorUserId: actor.id,
  });
  assert.equal(cancelled.status, "CANCELLED");
  assert.equal(cancelled.availabilityBlockId, null);

  const cancelledBlock = await db.vehicleAvailabilityBlock.findUnique({
    where: { id: cancellable.availabilityBlockId! },
  });
  assert.equal(cancelledBlock, null);

  console.log("Fleet maintenance lifecycle verification passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
