import { getDb, Prisma } from "@yatra/db/client";

export const vehicleStatuses = ["ACTIVE", "INACTIVE", "MAINTENANCE", "RETIRED"] as const;
export const driverStatuses = ["ACTIVE", "INACTIVE", "ON_LEAVE", "SUSPENDED"] as const;

export type VehicleStatusValue = (typeof vehicleStatuses)[number];
export type DriverStatusValue = (typeof driverStatuses)[number];

export function isVehicleStatus(value: string): value is VehicleStatusValue {
  return (vehicleStatuses as readonly string[]).includes(value);
}

export function isDriverStatus(value: string): value is DriverStatusValue {
  return (driverStatuses as readonly string[]).includes(value);
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function assertWindow(startsAt: Date, endsAt: Date) {
  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    startsAt >= endsAt
  ) {
    throw new Error("Availability block requires a valid start before end.");
  }
}

export async function createVehicle(input: {
  displayName: string;
  registrationNumber: string;
  vehicleClassId: string;
  seats: number;
  luggage: number | null;
  airConditioned: boolean;
  description: string;
  isFeatured: boolean;
  actorUserId: string;
}) {
  const displayName = input.displayName.trim();
  const registrationNumber = input.registrationNumber.trim().toUpperCase();

  if (displayName.length < 2 || displayName.length > 120) {
    throw new Error("Vehicle name must be between 2 and 120 characters.");
  }
  if (!/^[A-Z0-9 -]{4,30}$/.test(registrationNumber)) {
    throw new Error("Registration number format is invalid.");
  }
  if (!Number.isInteger(input.seats) || input.seats < 1 || input.seats > 80) {
    throw new Error("Seats must be between 1 and 80.");
  }
  if (
    input.luggage !== null &&
    (!Number.isInteger(input.luggage) || input.luggage < 0 || input.luggage > 100)
  ) {
    throw new Error("Luggage capacity is invalid.");
  }

  const db = getDb();

  return db.$transaction(
    async (tx) => {
      const vehicleClass = await tx.vehicleClass.findFirst({
        where: { id: input.vehicleClassId, isActive: true },
        select: { id: true },
      });
      if (!vehicleClass) throw new Error("Vehicle class is not active.");

      const slugBase = normalizeSlug(displayName) || "vehicle";
      let slug = slugBase;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const exists = await tx.vehicle.findUnique({
          where: { slug },
          select: { id: true },
        });
        if (!exists) break;
        slug = `${slugBase}-${attempt + 2}`;
      }

      const vehicle = await tx.vehicle.create({
        data: {
          slug,
          registrationNumber,
          displayName,
          vehicleClassId: input.vehicleClassId,
          status: "ACTIVE",
          seats: input.seats,
          luggage: input.luggage,
          airConditioned: input.airConditioned,
          description: input.description.trim() || null,
          isFeatured: input.isFeatured,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "VEHICLE_CREATED",
          entityType: "Vehicle",
          entityId: vehicle.id,
          metadata: {
            registrationNumber,
            displayName,
            vehicleClassId: input.vehicleClassId,
          },
        },
      });

      return vehicle;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function updateVehicle(input: {
  vehicleId: string;
  displayName: string;
  vehicleClassId: string;
  status: VehicleStatusValue;
  seats: number;
  luggage: number | null;
  airConditioned: boolean;
  description: string;
  isFeatured: boolean;
  actorUserId: string;
}) {
  if (input.displayName.trim().length < 2 || input.displayName.trim().length > 120) {
    throw new Error("Vehicle name must be between 2 and 120 characters.");
  }
  if (!Number.isInteger(input.seats) || input.seats < 1 || input.seats > 80) {
    throw new Error("Seats must be between 1 and 80.");
  }
  if (
    input.luggage !== null &&
    (!Number.isInteger(input.luggage) || input.luggage < 0 || input.luggage > 100)
  ) {
    throw new Error("Luggage capacity is invalid.");
  }

  const db = getDb();

  return db.$transaction(
    async (tx) => {
      const current = await tx.vehicle.findUnique({
        where: { id: input.vehicleId },
        select: {
          id: true,
          displayName: true,
          vehicleClassId: true,
          status: true,
        },
      });
      if (!current) throw new Error("Vehicle not found.");

      const vehicleClass = await tx.vehicleClass.findFirst({
        where: { id: input.vehicleClassId, isActive: true },
        select: { id: true },
      });
      if (!vehicleClass) throw new Error("Vehicle class is not active.");

      if (current.vehicleClassId !== input.vehicleClassId) {
        const activeAssignments = await tx.carBooking.count({
          where: {
            selectedVehicleId: input.vehicleId,
            status: { in: ["CONFIRMED", "DRIVER_ASSIGNED", "IN_PROGRESS"] },
          },
        });
        if (activeAssignments > 0) {
          throw new Error("Vehicle class cannot change while active bookings are assigned.");
        }
      }

      const updated = await tx.vehicle.update({
        where: { id: input.vehicleId },
        data: {
          displayName: input.displayName.trim(),
          vehicleClassId: input.vehicleClassId,
          status: input.status,
          seats: input.seats,
          luggage: input.luggage,
          airConditioned: input.airConditioned,
          description: input.description.trim() || null,
          isFeatured: input.isFeatured,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "VEHICLE_UPDATED",
          entityType: "Vehicle",
          entityId: input.vehicleId,
          metadata: {
            fromStatus: current.status,
            toStatus: input.status,
            fromVehicleClassId: current.vehicleClassId,
            toVehicleClassId: input.vehicleClassId,
          },
        },
      });

      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function addVehicleAvailabilityBlock(input: {
  vehicleId: string;
  startsAt: Date;
  endsAt: Date;
  reason: string;
  actorUserId: string;
}) {
  assertWindow(input.startsAt, input.endsAt);
  const db = getDb();

  return db.$transaction(async (tx) => {
    const vehicle = await tx.vehicle.findUnique({
      where: { id: input.vehicleId },
      select: { id: true, displayName: true },
    });
    if (!vehicle) throw new Error("Vehicle not found.");

    const block = await tx.vehicleAvailabilityBlock.create({
      data: {
        vehicleId: input.vehicleId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        reason: input.reason.trim().slice(0, 500) || null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "VEHICLE_AVAILABILITY_BLOCK_CREATED",
        entityType: "VehicleAvailabilityBlock",
        entityId: block.id,
        metadata: {
          vehicleId: input.vehicleId,
          startsAt: input.startsAt.toISOString(),
          endsAt: input.endsAt.toISOString(),
          reason: block.reason,
        },
      },
    });

    return block;
  });
}

export async function deleteVehicleAvailabilityBlock(input: {
  vehicleId: string;
  blockId: string;
  actorUserId: string;
}) {
  const db = getDb();

  return db.$transaction(async (tx) => {
    const block = await tx.vehicleAvailabilityBlock.findFirst({
      where: { id: input.blockId, vehicleId: input.vehicleId },
    });
    if (!block) throw new Error("Vehicle availability block not found.");

    await tx.vehicleAvailabilityBlock.delete({ where: { id: block.id } });
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "VEHICLE_AVAILABILITY_BLOCK_DELETED",
        entityType: "VehicleAvailabilityBlock",
        entityId: block.id,
        metadata: { vehicleId: input.vehicleId },
      },
    });
  });
}

export async function createDriver(input: {
  displayName: string;
  licenseExpiry: Date | null;
  internalNotes: string;
  qualificationIds: string[];
  actorUserId: string;
}) {
  const displayName = input.displayName.trim();
  if (displayName.length < 2 || displayName.length > 120) {
    throw new Error("Driver name must be between 2 and 120 characters.");
  }

  const qualificationIds = [...new Set(input.qualificationIds)];
  if (qualificationIds.length === 0) {
    throw new Error("At least one vehicle-class qualification is required.");
  }

  const db = getDb();

  return db.$transaction(
    async (tx) => {
      const classes = await tx.vehicleClass.findMany({
        where: { id: { in: qualificationIds }, isActive: true },
        select: { id: true },
      });
      if (classes.length !== qualificationIds.length) {
        throw new Error("One or more vehicle classes are unavailable.");
      }

      const driver = await tx.driver.create({
        data: {
          displayName,
          status: "ACTIVE",
          licenseExpiry: input.licenseExpiry,
          internalNotes: input.internalNotes.trim().slice(0, 1000) || null,
          qualifications: {
            create: qualificationIds.map((vehicleClassId) => ({ vehicleClassId })),
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "DRIVER_CREATED",
          entityType: "Driver",
          entityId: driver.id,
          metadata: {
            displayName,
            qualificationIds,
            licenseExpiry: input.licenseExpiry?.toISOString() ?? null,
          },
        },
      });

      return driver;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function updateDriver(input: {
  driverId: string;
  displayName: string;
  status: DriverStatusValue;
  licenseExpiry: Date | null;
  internalNotes: string;
  qualificationIds: string[];
  actorUserId: string;
}) {
  const displayName = input.displayName.trim();
  if (displayName.length < 2 || displayName.length > 120) {
    throw new Error("Driver name must be between 2 and 120 characters.");
  }

  const qualificationIds = [...new Set(input.qualificationIds)];
  if (qualificationIds.length === 0) {
    throw new Error("At least one vehicle-class qualification is required.");
  }

  const db = getDb();

  return db.$transaction(
    async (tx) => {
      const current = await tx.driver.findUnique({
        where: { id: input.driverId },
        include: { qualifications: true },
      });
      if (!current) throw new Error("Driver not found.");

      const classes = await tx.vehicleClass.findMany({
        where: { id: { in: qualificationIds }, isActive: true },
        select: { id: true },
      });
      if (classes.length !== qualificationIds.length) {
        throw new Error("One or more vehicle classes are unavailable.");
      }

      const currentQualificationIds = current.qualifications.map(
        (item) => item.vehicleClassId,
      );
      const removingQualification = currentQualificationIds.some(
        (id) => !qualificationIds.includes(id),
      );

      if (removingQualification || input.status !== "ACTIVE") {
        const activeAssignments = await tx.carBooking.count({
          where: {
            assignedDriverId: input.driverId,
            status: { in: ["CONFIRMED", "DRIVER_ASSIGNED", "IN_PROGRESS"] },
          },
        });
        if (activeAssignments > 0) {
          throw new Error("Driver access/qualification cannot be reduced while active bookings are assigned.");
        }
      }

      await tx.driverVehicleClass.deleteMany({
        where: {
          driverId: input.driverId,
          vehicleClassId: { notIn: qualificationIds },
        },
      });

      for (const vehicleClassId of qualificationIds) {
        await tx.driverVehicleClass.upsert({
          where: {
            driverId_vehicleClassId: {
              driverId: input.driverId,
              vehicleClassId,
            },
          },
          update: {},
          create: {
            driverId: input.driverId,
            vehicleClassId,
          },
        });
      }

      const updated = await tx.driver.update({
        where: { id: input.driverId },
        data: {
          displayName,
          status: input.status,
          licenseExpiry: input.licenseExpiry,
          internalNotes: input.internalNotes.trim().slice(0, 1000) || null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "DRIVER_UPDATED",
          entityType: "Driver",
          entityId: input.driverId,
          metadata: {
            fromStatus: current.status,
            toStatus: input.status,
            fromQualificationIds: currentQualificationIds,
            toQualificationIds: qualificationIds,
            licenseExpiry: input.licenseExpiry?.toISOString() ?? null,
          },
        },
      });

      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function addDriverAvailabilityBlock(input: {
  driverId: string;
  startsAt: Date;
  endsAt: Date;
  reason: string;
  actorUserId: string;
}) {
  assertWindow(input.startsAt, input.endsAt);
  const db = getDb();

  return db.$transaction(async (tx) => {
    const driver = await tx.driver.findUnique({
      where: { id: input.driverId },
      select: { id: true, displayName: true },
    });
    if (!driver) throw new Error("Driver not found.");

    const block = await tx.driverAvailabilityBlock.create({
      data: {
        driverId: input.driverId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        reason: input.reason.trim().slice(0, 500) || null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "DRIVER_AVAILABILITY_BLOCK_CREATED",
        entityType: "DriverAvailabilityBlock",
        entityId: block.id,
        metadata: {
          driverId: input.driverId,
          startsAt: input.startsAt.toISOString(),
          endsAt: input.endsAt.toISOString(),
          reason: block.reason,
        },
      },
    });

    return block;
  });
}

export async function deleteDriverAvailabilityBlock(input: {
  driverId: string;
  blockId: string;
  actorUserId: string;
}) {
  const db = getDb();

  return db.$transaction(async (tx) => {
    const block = await tx.driverAvailabilityBlock.findFirst({
      where: { id: input.blockId, driverId: input.driverId },
    });
    if (!block) throw new Error("Driver availability block not found.");

    await tx.driverAvailabilityBlock.delete({ where: { id: block.id } });
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "DRIVER_AVAILABILITY_BLOCK_DELETED",
        entityType: "DriverAvailabilityBlock",
        entityId: block.id,
        metadata: { driverId: input.driverId },
      },
    });
  });
}


export async function attachVehicleMedia(input: {
  vehicleId: string;
  mediaId: string;
  isPrimary: boolean;
  actorUserId: string;
}) {
  const db = getDb();

  return db.$transaction(
    async (tx) => {
      const [vehicle, media] = await Promise.all([
        tx.vehicle.findUnique({
          where: { id: input.vehicleId },
          select: { id: true, displayName: true },
        }),
        tx.mediaAsset.findUnique({
          where: { id: input.mediaId },
          select: { id: true, mimeType: true, publicUrl: true },
        }),
      ]);

      if (!vehicle) throw new Error("Vehicle not found.");
      if (!media) throw new Error("Media asset not found.");
      if (!media.mimeType.startsWith("image/") || !media.publicUrl) {
        throw new Error("Vehicle media must be a public image asset.");
      }

      if (input.isPrimary) {
        await tx.vehicleMedia.updateMany({
          where: { vehicleId: input.vehicleId },
          data: { isPrimary: false },
        });
      }

      const existingCount = await tx.vehicleMedia.count({
        where: { vehicleId: input.vehicleId },
      });

      const link = await tx.vehicleMedia.upsert({
        where: {
          vehicleId_mediaId: {
            vehicleId: input.vehicleId,
            mediaId: input.mediaId,
          },
        },
        update: {
          isPrimary: input.isPrimary,
        },
        create: {
          vehicleId: input.vehicleId,
          mediaId: input.mediaId,
          sortOrder: existingCount,
          isPrimary: input.isPrimary || existingCount === 0,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "VEHICLE_MEDIA_ATTACHED",
          entityType: "Vehicle",
          entityId: input.vehicleId,
          metadata: {
            mediaId: input.mediaId,
            isPrimary: link.isPrimary,
          },
        },
      });

      return link;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function setPrimaryVehicleMedia(input: {
  vehicleId: string;
  mediaId: string;
  actorUserId: string;
}) {
  const db = getDb();

  return db.$transaction(async (tx) => {
    const link = await tx.vehicleMedia.findUnique({
      where: {
        vehicleId_mediaId: {
          vehicleId: input.vehicleId,
          mediaId: input.mediaId,
        },
      },
      select: { vehicleId: true, mediaId: true },
    });

    if (!link) throw new Error("Vehicle media link not found.");

    await tx.vehicleMedia.updateMany({
      where: { vehicleId: input.vehicleId },
      data: { isPrimary: false },
    });

    await tx.vehicleMedia.update({
      where: {
        vehicleId_mediaId: {
          vehicleId: input.vehicleId,
          mediaId: input.mediaId,
        },
      },
      data: { isPrimary: true },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "VEHICLE_PRIMARY_MEDIA_CHANGED",
        entityType: "Vehicle",
        entityId: input.vehicleId,
        metadata: { mediaId: input.mediaId },
      },
    });
  });
}

export async function detachVehicleMedia(input: {
  vehicleId: string;
  mediaId: string;
  actorUserId: string;
}) {
  const db = getDb();

  return db.$transaction(async (tx) => {
    const link = await tx.vehicleMedia.findUnique({
      where: {
        vehicleId_mediaId: {
          vehicleId: input.vehicleId,
          mediaId: input.mediaId,
        },
      },
    });

    if (!link) throw new Error("Vehicle media link not found.");

    await tx.vehicleMedia.delete({
      where: {
        vehicleId_mediaId: {
          vehicleId: input.vehicleId,
          mediaId: input.mediaId,
        },
      },
    });

    if (link.isPrimary) {
      const next = await tx.vehicleMedia.findFirst({
        where: { vehicleId: input.vehicleId },
        orderBy: [{ sortOrder: "asc" }, { mediaId: "asc" }],
      });

      if (next) {
        await tx.vehicleMedia.update({
          where: {
            vehicleId_mediaId: {
              vehicleId: next.vehicleId,
              mediaId: next.mediaId,
            },
          },
          data: { isPrimary: true },
        });
      }
    }

    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "VEHICLE_MEDIA_DETACHED",
        entityType: "Vehicle",
        entityId: input.vehicleId,
        metadata: {
          mediaId: input.mediaId,
          wasPrimary: link.isPrimary,
        },
      },
    });
  });
}
