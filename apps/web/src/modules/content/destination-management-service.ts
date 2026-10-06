import { getDb, Prisma } from "@yatra/db/client";

export const destinationKinds = [
  "CITY",
  "TEMPLE",
  "NATURE",
  "HERITAGE",
  "REGION",
] as const;

export type DestinationKindValue = (typeof destinationKinds)[number];

export function isDestinationKind(
  value: string,
): value is DestinationKindValue {
  return (destinationKinds as readonly string[]).includes(value);
}

function parseOptionalJson(
  raw: string,
  label: string,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  const text = raw.trim();
  if (!text) return Prisma.DbNull;

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }

  const serialized = JSON.stringify(value);
  if (serialized.length > 50_000) {
    throw new Error(`${label} is too large.`);
  }

  return value as Prisma.InputJsonValue;
}

export function stringifyOptionalJson(value: unknown): string {
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

export async function updateDestinationDetails(input: {
  destinationId: string;
  kind: DestinationKindValue;
  summary: string;
  isFeatured: boolean;
  actorUserId: string;
}) {
  const summary = input.summary.trim();
  if (summary.length > 700) {
    throw new Error("Destination summary cannot exceed 700 characters.");
  }

  const db = getDb();

  return db.$transaction(
    async (tx) => {
      const current = await tx.destination.findUnique({
        where: { id: input.destinationId },
        include: {
          templeProfile: { select: { id: true } },
        },
      });

      if (!current) throw new Error("Destination not found.");

      if (
        input.kind !== "TEMPLE" &&
        current.templeProfile
      ) {
        throw new Error(
          "Remove the Temple Profile before changing this destination to a non-temple kind.",
        );
      }

      const latestRevision = await tx.contentRevision.aggregate({
        where: {
          entityType: "destination",
          entityId: input.destinationId,
        },
        _max: { version: true },
      });

      await tx.contentRevision.create({
        data: {
          entityType: "destination",
          entityId: input.destinationId,
          version: (latestRevision._max.version ?? 0) + 1,
          createdBy: input.actorUserId,
          payload: {
            kind: current.kind,
            summary: current.summary,
            isFeatured: current.isFeatured,
          } as Prisma.InputJsonValue,
        },
      });

      const updated = await tx.destination.update({
        where: { id: input.destinationId },
        data: {
          kind: input.kind,
          summary: summary || null,
          isFeatured: input.isFeatured,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "DESTINATION_DETAILS_UPDATED",
          entityType: "Destination",
          entityId: input.destinationId,
          metadata: {
            fromKind: current.kind,
            toKind: input.kind,
            fromFeatured: current.isFeatured,
            toFeatured: input.isFeatured,
          },
        },
      });

      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function saveTempleProfile(input: {
  destinationId: string;
  templeName: string;
  deity: string;
  darshanNotes: string;
  dressCode: string;
  openingHoursJson: string;
  nearbyPlacesJson: string;
  practicalNotesJson: string;
  actorUserId: string;
}) {
  const templeName = input.templeName.trim();
  if (templeName.length < 2 || templeName.length > 180) {
    throw new Error("Temple name must be between 2 and 180 characters.");
  }

  const db = getDb();

  return db.$transaction(
    async (tx) => {
      const destination = await tx.destination.findUnique({
        where: { id: input.destinationId },
        select: {
          id: true,
          kind: true,
          name: true,
        },
      });

      if (!destination) throw new Error("Destination not found.");
      if (destination.kind !== "TEMPLE") {
        throw new Error("Temple Profiles can only be attached to TEMPLE destinations.");
      }

      const current = await tx.templeProfile.findUnique({
        where: { destinationId: input.destinationId },
      });

      if (current) {
        const latestRevision = await tx.contentRevision.aggregate({
          where: {
            entityType: "templeProfile",
            entityId: current.id,
          },
          _max: { version: true },
        });

        await tx.contentRevision.create({
          data: {
            entityType: "templeProfile",
            entityId: current.id,
            version: (latestRevision._max.version ?? 0) + 1,
            createdBy: input.actorUserId,
            payload: {
              templeName: current.templeName,
              deity: current.deity,
              darshanNotes: current.darshanNotes,
              dressCode: current.dressCode,
              openingHours: current.openingHours,
              nearbyPlaces: current.nearbyPlaces,
              practicalNotes: current.practicalNotes,
            } as Prisma.InputJsonValue,
          },
        });
      }

      const profile = await tx.templeProfile.upsert({
        where: { destinationId: input.destinationId },
        update: {
          templeName,
          deity: input.deity.trim() || null,
          darshanNotes: input.darshanNotes.trim() || null,
          dressCode: input.dressCode.trim() || null,
          openingHours: parseOptionalJson(
            input.openingHoursJson,
            "Opening hours",
          ),
          nearbyPlaces: parseOptionalJson(
            input.nearbyPlacesJson,
            "Nearby places",
          ),
          practicalNotes: parseOptionalJson(
            input.practicalNotesJson,
            "Practical notes",
          ),
        },
        create: {
          destinationId: input.destinationId,
          templeName,
          deity: input.deity.trim() || null,
          darshanNotes: input.darshanNotes.trim() || null,
          dressCode: input.dressCode.trim() || null,
          openingHours: parseOptionalJson(
            input.openingHoursJson,
            "Opening hours",
          ),
          nearbyPlaces: parseOptionalJson(
            input.nearbyPlacesJson,
            "Nearby places",
          ),
          practicalNotes: parseOptionalJson(
            input.practicalNotesJson,
            "Practical notes",
          ),
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: current
            ? "TEMPLE_PROFILE_UPDATED"
            : "TEMPLE_PROFILE_CREATED",
          entityType: "TempleProfile",
          entityId: profile.id,
          metadata: {
            destinationId: input.destinationId,
            destinationName: destination.name,
          },
        },
      });

      return profile;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function removeTempleProfile(input: {
  destinationId: string;
  actorUserId: string;
}) {
  const db = getDb();

  return db.$transaction(async (tx) => {
    const profile = await tx.templeProfile.findUnique({
      where: { destinationId: input.destinationId },
    });

    if (!profile) throw new Error("Temple Profile not found.");

    await tx.templeProfile.delete({
      where: { id: profile.id },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "TEMPLE_PROFILE_REMOVED",
        entityType: "TempleProfile",
        entityId: profile.id,
        metadata: {
          destinationId: input.destinationId,
          templeName: profile.templeName,
        },
      },
    });
  });
}
