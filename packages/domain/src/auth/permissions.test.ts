import test from "node:test";
import assert from "node:assert/strict";
import {
  hasPermission,
  permissions,
  rolePermissions,
  roles,
  type Permission,
  type RoleKey,
} from "./permissions";

test("every declared role has a permission entry", () => {
  assert.deepEqual(
    [...Object.keys(rolePermissions)].sort(),
    [...roles].sort(),
  );
});

test("super admin receives every admin permission and no customer self permission", () => {
  const adminPermissions = permissions.filter(
    (permission) => !permission.startsWith("customer.self."),
  );

  assert.deepEqual(
    [...rolePermissions.SUPER_ADMIN].sort(),
    [...adminPermissions].sort(),
  );
  assert.equal(hasPermission(["SUPER_ADMIN"], "customer.self.read"), false);
});

test("customer never receives admin access", () => {
  assert.equal(hasPermission(["CUSTOMER"], "admin.access"), false);
  assert.equal(hasPermission(["CUSTOMER"], "booking.read"), false);
  assert.equal(hasPermission(["CUSTOMER"], "customer.self.read"), true);
  assert.equal(hasPermission(["CUSTOMER"], "customer.self.write"), true);
});

test("operations can dispatch but cannot change booking lifecycle or finance", () => {
  assert.equal(hasPermission(["OPERATIONS"], "admin.access"), true);
  assert.equal(hasPermission(["OPERATIONS"], "booking.read"), true);
  assert.equal(hasPermission(["OPERATIONS"], "booking.assign"), true);
  assert.equal(hasPermission(["OPERATIONS"], "booking.write"), false);
  assert.equal(hasPermission(["OPERATIONS"], "refund.manage"), false);
  assert.equal(hasPermission(["OPERATIONS"], "payment.reconcile"), false);
});

test("booking sales can manage bookings but cannot assign fleet or refund", () => {
  assert.equal(hasPermission(["BOOKING_SALES"], "booking.write"), true);
  assert.equal(hasPermission(["BOOKING_SALES"], "booking.assign"), false);
  assert.equal(hasPermission(["BOOKING_SALES"], "refund.manage"), false);
  assert.equal(hasPermission(["BOOKING_SALES"], "vehicle.write"), false);
});

test("finance can reconcile and refund but cannot mutate bookings or fleet", () => {
  assert.equal(hasPermission(["FINANCE"], "payment.reconcile"), true);
  assert.equal(hasPermission(["FINANCE"], "refund.manage"), true);
  assert.equal(hasPermission(["FINANCE"], "report.read"), true);
  assert.equal(hasPermission(["FINANCE"], "booking.write"), false);
  assert.equal(hasPermission(["FINANCE"], "booking.assign"), false);
  assert.equal(hasPermission(["FINANCE"], "vehicle.write"), false);
});

test("auditor remains read-only and owns audit visibility", () => {
  const readPermissions: Permission[] = [
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
  ];

  for (const permission of readPermissions) {
    assert.equal(hasPermission(["AUDITOR"], permission), true);
  }

  const forbidden: Permission[] = [
    "booking.write",
    "booking.assign",
    "vehicle.write",
    "driver.write",
    "package.write",
    "content.write",
    "lead.write",
    "customer.write",
    "payment.reconcile",
    "refund.manage",
    "settings.manage",
    "staff.manage",
  ];

  for (const permission of forbidden) {
    assert.equal(hasPermission(["AUDITOR"], permission), false);
  }
});

test("owner admin cannot read audit log while super admin can", () => {
  assert.equal(hasPermission(["OWNER_ADMIN"], "audit.read"), false);
  assert.equal(hasPermission(["SUPER_ADMIN"], "audit.read"), true);
});

test("combined roles receive the union of their permissions", () => {
  const combined: RoleKey[] = ["OPERATIONS", "FINANCE"];
  assert.equal(hasPermission(combined, "booking.assign"), true);
  assert.equal(hasPermission(combined, "refund.manage"), true);
  assert.equal(hasPermission(combined, "booking.write"), false);
});
