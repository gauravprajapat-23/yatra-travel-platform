import { createHash, randomBytes } from "node:crypto";
import { getDb, Prisma } from "@yatra/db/client";
import { hashPassword } from "@/lib/auth/password";
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

async function actorIsSuperAdmin(
  tx: Prisma.TransactionClient,
  actorUserId: string,
): Promise<boolean> {
  const actor = await tx.user.findFirst({
    where: {
      id: actorUserId,
      status: "ACTIVE",
      roles: {
        some: {
          role: { key: "SUPER_ADMIN" },
        },
      },
    },
    select: { id: true },
  });

  return Boolean(actor);
}

function assertSuperAdminManagementAllowed(input: {
  actorIsSuperAdmin: boolean;
  currentRoles?: readonly RoleKey[];
  nextRoles?: readonly RoleKey[];
}) {
  const touchesSuperAdmin =
    input.currentRoles?.includes("SUPER_ADMIN") ||
    input.nextRoles?.includes("SUPER_ADMIN");

  if (touchesSuperAdmin && !input.actorIsSuperAdmin) {
    throw new Error("Only a SUPER_ADMIN can grant or manage SUPER_ADMIN access.");
  }
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

      if (input.status === "ACTIVE" && !target.passwordHash) {
        throw new Error(
          "Invited staff must complete password setup before activation.",
        );
      }

      if (input.status === "INVITED" && target.status !== "INVITED") {
        throw new Error(
          "Existing staff accounts cannot be moved back to INVITED.",
        );
      }

      const currentRoles = target.roles
        .map((entry) => entry.role.key as RoleKey)
        .filter((role) => role !== "CUSTOMER");

      assertSuperAdminManagementAllowed({
        actorIsSuperAdmin: await actorIsSuperAdmin(tx, input.actorUserId),
        currentRoles,
        nextRoles: uniqueRoles,
      });

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


export async function revokeStaffSessions(input: {
  targetUserId: string;
  actorUserId: string;
}) {
  if (input.targetUserId === input.actorUserId) {
    throw new Error("Use the normal logout flow to revoke your own current session.");
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

      const targetRoles = target.roles
        .map((entry) => entry.role.key as RoleKey)
        .filter((role) => role !== "CUSTOMER");

      assertSuperAdminManagementAllowed({
        actorIsSuperAdmin: await actorIsSuperAdmin(tx, input.actorUserId),
        currentRoles: targetRoles,
      });

      const hasAdminRole = targetRoles.length > 0;

      if (!hasAdminRole) {
        throw new Error("Target user is not an admin staff account.");
      }

      const result = await tx.session.updateMany({
        where: {
          userId: input.targetUserId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "STAFF_SESSIONS_REVOKED",
          entityType: "User",
          entityId: input.targetUserId,
          metadata: {
            email: target.email,
            revokedSessions: result.count,
          },
        },
      });

      return { revokedSessions: result.count };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}


function normalizeStaffEmail(value: string): string {
  const email = value.trim().toLowerCase();

  if (
    !email ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error("Enter a valid staff email address.");
  }

  return email;
}

function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function validateInvitePassword(password: string): void {
  if (password.length < 12 || password.length > 128) {
    throw new Error("Password must be between 12 and 128 characters.");
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error("Password must include at least one letter and one number.");
  }
}

export async function createStaffInvite(input: {
  email: string;
  name: string;
  roles: Array<Exclude<RoleKey, "CUSTOMER">>;
  actorUserId: string;
  expiresInHours?: number;
}) {
  const emailNormalized = normalizeStaffEmail(input.email);
  const name = input.name.trim();
  const uniqueRoles = [...new Set(input.roles)];

  if (name.length < 2 || name.length > 120) {
    throw new Error("Staff name must be between 2 and 120 characters.");
  }

  if (uniqueRoles.length === 0 || uniqueRoles.some((role) => !isAdminRole(role))) {
    throw new Error("At least one valid admin role is required.");
  }

  const expiresInHours = input.expiresInHours ?? 48;
  if (
    !Number.isInteger(expiresInHours) ||
    expiresInHours < 1 ||
    expiresInHours > 168
  ) {
    throw new Error("Invite expiry must be between 1 and 168 hours.");
  }

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashInviteToken(rawToken);
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
  const db = getDb();

  const result = await db.$transaction(
    async (tx) => {
      const existing = await tx.user.findUnique({
        where: { emailNormalized },
        select: { id: true, status: true },
      });

      if (existing) {
        throw new Error(
          "An account already exists for this email. Use the existing staff/customer account workflow instead.",
        );
      }

      assertSuperAdminManagementAllowed({
        actorIsSuperAdmin: await actorIsSuperAdmin(tx, input.actorUserId),
        nextRoles: uniqueRoles,
      });

      const roleRows = await tx.role.findMany({
        where: { key: { in: uniqueRoles } },
        select: { id: true, key: true },
      });

      if (roleRows.length !== uniqueRoles.length) {
        throw new Error("One or more requested roles do not exist.");
      }

      const user = await tx.user.create({
        data: {
          email: emailNormalized,
          emailNormalized,
          name,
          status: "INVITED",
        },
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
        },
      });

      await tx.userRole.createMany({
        data: roleRows.map((role) => ({
          userId: user.id,
          roleId: role.id,
          assignedById: input.actorUserId,
        })),
      });

      const invite = await tx.staffInvite.create({
        data: {
          userId: user.id,
          tokenHash,
          createdById: input.actorUserId,
          expiresAt,
        },
        select: {
          id: true,
          expiresAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "STAFF_INVITED",
          entityType: "User",
          entityId: user.id,
          metadata: {
            roles: uniqueRoles,
            inviteId: invite.id,
            expiresAt: invite.expiresAt.toISOString(),
          },
        },
      });

      return { user, invite };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  return {
    ...result,
    token: rawToken,
  };
}

export async function inspectStaffInvite(token: string) {
  const value = token.trim();
  if (!value || value.length > 512) return null;

  const db = getDb();
  const now = new Date();

  const invite = await db.staffInvite.findUnique({
    where: { tokenHash: hashInviteToken(value) },
    select: {
      id: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
        },
      },
    },
  });

  if (
    !invite ||
    invite.acceptedAt ||
    invite.revokedAt ||
    invite.expiresAt <= now ||
    invite.user.status !== "INVITED"
  ) {
    return null;
  }

  return invite;
}

export async function acceptStaffInvite(input: {
  token: string;
  password: string;
}) {
  const token = input.token.trim();
  if (!token || token.length > 512) {
    throw new Error("Invite link is invalid or expired.");
  }

  validateInvitePassword(input.password);

  const tokenHash = hashInviteToken(token);
  const passwordHash = await hashPassword(input.password);
  const now = new Date();
  const db = getDb();

  return db.$transaction(
    async (tx) => {
      const invite = await tx.staffInvite.findUnique({
        where: { tokenHash },
        include: {
          user: {
            include: {
              roles: {
                include: { role: true },
              },
            },
          },
        },
      });

      if (
        !invite ||
        invite.acceptedAt ||
        invite.revokedAt ||
        invite.expiresAt <= now ||
        invite.user.status !== "INVITED"
      ) {
        throw new Error("Invite link is invalid or expired.");
      }

      const claimed = await tx.staffInvite.updateMany({
        where: {
          id: invite.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { acceptedAt: now },
      });

      if (claimed.count !== 1) {
        throw new Error("Invite link has already been used or expired.");
      }

      const user = await tx.user.update({
        where: { id: invite.userId },
        data: {
          passwordHash,
          status: "ACTIVE",
          emailVerifiedAt: now,
        },
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "STAFF_INVITE_ACCEPTED",
          entityType: "User",
          entityId: user.id,
          metadata: {
            inviteId: invite.id,
            roles: invite.user.roles.map((entry) => entry.role.key),
          },
        },
      });

      return user;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function revokeStaffInvite(input: {
  targetUserId: string;
  actorUserId: string;
}) {
  const db = getDb();
  const now = new Date();

  return db.$transaction(
    async (tx) => {
      const invite = await tx.staffInvite.findUnique({
        where: { userId: input.targetUserId },
        include: {
          user: {
            select: {
              id: true,
              status: true,
              roles: {
                include: { role: true },
              },
            },
          },
        },
      });

      if (!invite || invite.user.status !== "INVITED") {
        throw new Error("No pending staff invite exists for this user.");
      }

      const invitedRoles = invite.user.roles
        .map((entry) => entry.role.key as RoleKey)
        .filter((role) => role !== "CUSTOMER");

      assertSuperAdminManagementAllowed({
        actorIsSuperAdmin: await actorIsSuperAdmin(tx, input.actorUserId),
        currentRoles: invitedRoles,
      });

      if (invite.acceptedAt || invite.revokedAt) {
        throw new Error("Staff invite is no longer active.");
      }

      await tx.staffInvite.update({
        where: { id: invite.id },
        data: { revokedAt: now },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "STAFF_INVITE_CANCELLED",
          entityType: "User",
          entityId: input.targetUserId,
          metadata: {
            inviteId: invite.id,
            invitedAccountDeleted: true,
          },
        },
      });

      await tx.user.delete({
        where: { id: input.targetUserId },
      });

      return { revokedAt: now, invitedAccountDeleted: true };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}


export async function renewStaffInvite(input: {
  targetUserId: string;
  actorUserId: string;
  expiresInHours?: number;
}) {
  const expiresInHours = input.expiresInHours ?? 48;

  if (
    !Number.isInteger(expiresInHours) ||
    expiresInHours < 1 ||
    expiresInHours > 168
  ) {
    throw new Error("Invite expiry must be between 1 and 168 hours.");
  }

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashInviteToken(rawToken);
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
  const db = getDb();

  const result = await db.$transaction(
    async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: input.targetUserId },
        include: {
          roles: {
            include: { role: true },
          },
          staffInvite: true,
        },
      });

      if (!target || target.status !== "INVITED" || target.passwordHash) {
        throw new Error("Only pending invited staff can receive a new invite.");
      }

      const adminRoles = target.roles
        .map((entry) => entry.role.key as RoleKey)
        .filter((role) => role !== "CUSTOMER");

      assertSuperAdminManagementAllowed({
        actorIsSuperAdmin: await actorIsSuperAdmin(tx, input.actorUserId),
        currentRoles: adminRoles,
      });

      if (adminRoles.length === 0) {
        throw new Error("Invited account has no admin roles.");
      }

      const invite = target.staffInvite
        ? await tx.staffInvite.update({
            where: { id: target.staffInvite.id },
            data: {
              tokenHash,
              expiresAt,
              acceptedAt: null,
              revokedAt: null,
              createdById: input.actorUserId,
              createdAt: new Date(),
            },
            select: { id: true, expiresAt: true },
          })
        : await tx.staffInvite.create({
            data: {
              userId: target.id,
              tokenHash,
              expiresAt,
              createdById: input.actorUserId,
            },
            select: { id: true, expiresAt: true },
          });

      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "STAFF_INVITE_REGENERATED",
          entityType: "User",
          entityId: target.id,
          metadata: {
            inviteId: invite.id,
            roles: adminRoles,
            expiresAt: invite.expiresAt.toISOString(),
          },
        },
      });

      return invite;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  return {
    invite: result,
    token: rawToken,
  };
}
