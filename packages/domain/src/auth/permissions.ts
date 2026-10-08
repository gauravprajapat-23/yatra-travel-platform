export const roles = [
  "SUPER_ADMIN",
  "OWNER_ADMIN",
  "BOOKING_SALES",
  "OPERATIONS",
  "CONTENT_SEO",
  "FINANCE",
  "AUDITOR",
  "CUSTOMER",
] as const;

export type RoleKey = (typeof roles)[number];

export const permissions = [
  "admin.access",
  "staff.manage",
  "booking.read",
  "booking.write",
  "booking.assign",
  "vehicle.read",
  "vehicle.write",
  "driver.read",
  "driver.write",
  "package.read",
  "package.write",
  "content.read",
  "content.write",
  "seo.manage",
  "lead.read",
  "lead.write",
  "customer.read",
  "customer.write",
  "payment.read",
  "payment.reconcile",
  "refund.manage",
  "report.read",
  "audit.read",
  "notification.read",
  "notification.manage",
  "settings.manage",
  "customer.self.read",
  "customer.self.write",
] as const;

export type Permission = (typeof permissions)[number];

const allAdminPermissions = permissions.filter(
  (permission) => !permission.startsWith("customer.self."),
);

export const rolePermissions: Readonly<Record<RoleKey, readonly Permission[]>> = {
  SUPER_ADMIN: allAdminPermissions,
  OWNER_ADMIN: allAdminPermissions.filter((permission) => permission !== "audit.read"),
  BOOKING_SALES: [
    "admin.access",
    "booking.read",
    "booking.write",
    "vehicle.read",
    "package.read",
    "lead.read",
    "lead.write",
    "customer.read",
    "customer.write",
    "payment.read",
  ],
  OPERATIONS: [
    "admin.access",
    "booking.read",
    "booking.assign",
    "vehicle.read",
    "vehicle.write",
    "driver.read",
    "driver.write",
    "package.read",
    "customer.read",
  ],
  CONTENT_SEO: [
    "admin.access",
    "package.read",
    "package.write",
    "content.read",
    "content.write",
    "seo.manage",
  ],
  FINANCE: [
    "admin.access",
    "booking.read",
    "customer.read",
    "payment.read",
    "payment.reconcile",
    "refund.manage",
    "report.read",
  ],
  AUDITOR: [
    "admin.access",
    "booking.read",
    "vehicle.read",
    "driver.read",
    "package.read",
    "content.read",
    "lead.read",
    "customer.read",
    "payment.read",
    "report.read",
    "audit.read",
    "notification.read",
  ],
  CUSTOMER: ["customer.self.read", "customer.self.write"],
};

export function hasPermission(
  assignedRoles: readonly RoleKey[],
  permission: Permission,
): boolean {
  return assignedRoles.some((role) => rolePermissions[role].includes(permission));
}
