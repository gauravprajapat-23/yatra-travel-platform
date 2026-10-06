import { getDb, Prisma } from "@yatra/db/client";
import {
  roles,
  type RoleKey,
} from "@yatra/domain/auth/permissions";

export const adminRoleKeys = roles.filter(
  (role): role is Exclude<RoleKey, "CUSTOMER"> => role !== "CUSTOMER",
);

export const staffStatuses = [
  "ACTIVE",
  "INVITED",
  "SUSPENDED",
  "DISABLED",
] as const;

export type StaffStatus = (typeof staffStatuses)[number];

export function isStaffStatus(value: string): value is StaffStatus {
  return (staffStatuses as readonly string[]).includes(value);
}

export function isAdminRole(value: string): value is Exclude<RoleKey, "CUSTOMER"> {
  return (adminRoleKeys as readonly string[]).includes(value);
}

export async function updateStaffAccess(input: {
  targetUserId: string;
  actorUserId: string;
  status: StaffStatus;
  roles: Array<Exclude<RoleKey, "CUSTOMER">>;
}) {
  const uniqueRoles = [...new Set(input.roles)];

  if (uniqueRoles.length === 0) {
    throw new Error("At least one admin role is required.");
  }

  const db = getDb();

  return db.$transaction(
    async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: input.targetUserId },
        include: {
          roles: {
            include: { role: true },
          },
        },
      });

      if (!target) throw new Error("Staff user not found.");

      const currentRoles = target.roles
        .map((entry) => entry.role.key as RoleKey)
        .filter((role) => role !== "CUSTOMER");

      if (currentRoles.length === 0) {
        throw new Error("Target user is not an admin staff account.");
      }

      if (
        input.targetUserId === input.actorUserId &&
        input.status !== "ACTIVE"
      ) {
        throw new Error("You cannot disable or suspend your own account.");
      }

      const removesSuperAdmin =
        currentRoles.includes("SUPER_ADMIN") &&
        !uniqueRoles.includes("SUPER_ADMIN");
      const disablesSuperAdmin =
        currentRoles.includes("SUPER_ADMIN") &&
        input.status !== "ACTIVE";

      if (removesSuperAdmin || disablesSuperAdmin) {
        const otherActiveSuperAdmins = await tx.user.count({
          where: {
            id: { not: input.targetUserId },
            status: "ACTIVE",
            roles: {
              some: {
                role: { key: "SUPER_ADMIN" },
              },
            },
          },
        });

        if (otherActiveSuperAdmins === 0) {
          throw new Error("At least one active SUPER_ADMIN must remain.");
        }
      }

      const roleRows = await tx.role.findMany({
        where: { key: { in: uniqueRoles } },
        select: { id: true, key: true },
      });

      if (roleRows.length !== uniqueRoles.length) {
        throw new Error("One or more requested roles do not exist.");
      }

      await tx.userRole.deleteMany({
        where: {
          userId: input.targetUserId,
          role: {
            key: { notIn: uniqueRoles },
          },
        },
      });

      for (const role of roleRows) {
        await tx.userRole.upsert({
          where: {
            userId_roleId: {
              userId: input.targetUserId,
              roleId: role.id,
            },
          },
          update: {},
          create: {
            userId: input.targetUserId,
            roleId: role.id,
            assignedById: input.actorUserId,
          },
        });
      }

      const updated = await tx.user.update({
        where: { id: input.targetUserId },
        data: { status: input.status },
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
        },
      });

      const accessReduced =
        input.status !== "ACTIVE" ||
        currentRoles.some((role) => !uniqueRoles.includes(role as Exclude<RoleKey, "CUSTOMER">));

      if (accessReduced && input.targetUserId !== input.actorUserId) {
        await tx.session.updateMany({
          where: {
            userId: input.targetUserId,
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "STAFF_ACCESS_UPDATED",
          entityType: "User",
          entityId: input.targetUserId,
          metadata: {
            email: target.email,
            fromStatus: target.status,
            toStatus: input.status,
            fromRoles: currentRoles,
            toRoles: uniqueRoles,
            sessionsRevoked:
              accessReduced && input.targetUserId !== input.actorUserId,
          },
        },
      });

      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
