import assert from "node:assert/strict";
import test from "node:test";

import {
  inboxSearchParams,
  inboxStateFromSearch,
  notificationContextHref,
  notificationContextIsLinked,
  notificationNextAction,
  notificationStateLabel,
  passwordChangeError,
  settingsAdminShortcuts,
  visibleNotificationChannels
} from "../notification-inbox";

test("inbox URL keeps filters and page size", () => {
  const state = inboxStateFromSearch(new URLSearchParams("q=gate&status=UNREAD&page=2&pageSize=50&overdue=1"));
  assert.equal(state.q, "gate");
  assert.equal(state.status, "UNREAD");
  assert.equal(state.page, 2);
  assert.equal(state.pageSize, 50);
  assert.equal(state.overdue, true);
  assert.match(inboxSearchParams(state), /q=gate/);
  assert.match(inboxSearchParams(state), /pageSize=50/);
});

test("open context uses the exact job, vehicle, and plan routes", () => {
  assert.equal(
    notificationContextHref({ referenceType: "WorkOrder", referenceId: "wo-1", type: "WORK_ORDER_UPDATED" }),
    "/work-orders?wo=wo-1"
  );
  assert.equal(
    notificationContextHref({ title: "Verification required", referenceType: "WorkOrder", referenceId: "wo-2" }),
    "/work-orders?wo=wo-2&tab=evidence"
  );
  assert.equal(
    notificationContextHref({ title: "Gate blocked", referenceType: "Vehicle", referenceId: "veh-1" }),
    "/vehicles/veh-1"
  );
  // The gate screen is retired: stored deep links open the vehicle or the fleet list.
  assert.equal(notificationContextHref({ deepLink: "/fleet/gate?vehicle=veh-2" }), "/vehicles/veh-2");
  assert.equal(notificationContextHref({ deepLink: "/fleet/gate" }), "/fleet");
  assert.equal(notificationContextHref({ deepLink: "/work-orders?highlight=wo-9" }), "/work-orders?wo=wo-9");
  assert.equal(notificationContextIsLinked("/work-orders?wo=wo-1"), true);
  assert.equal(notificationContextIsLinked("/notifications"), false);
  assert.equal(notificationContextIsLinked("/notifications?status=UNREAD"), false);
  assert.equal(notificationContextIsLinked(notificationContextHref({ title: "Digest" })), false);
  assert.equal(notificationContextHref({ deepLink: "https://evil.example/phish" }), "/notifications");
  assert.equal(notificationContextHref({ deepLink: "//evil.example/phish" }), "/notifications");
  assert.equal(notificationContextHref({ deepLink: "javascript:alert(1)" }), "/notifications");
  assert.equal(notificationContextIsLinked("https://evil.example"), false);
  assert.equal(notificationContextIsLinked("/vehicles/veh-1"), true);
  assert.equal(notificationNextAction({ type: "LOW_STOCK" }), "Open parts");
  assert.equal(notificationNextAction({ type: "MAINTENANCE_DUE" }), "Open scheduled service plan");
});

test("notification state and settings helpers stay specific", () => {
  assert.equal(notificationStateLabel({ isRead: false, acknowledgedAt: null }), "Unread");
  assert.equal(notificationStateLabel({ isRead: true, acknowledgedAt: null }), "Read");
  assert.equal(notificationStateLabel({ isRead: true, acknowledgedAt: "2026-01-01" }), "Acknowledged");
  assert.deepEqual(visibleNotificationChannels({ inApp: true, email: true, sms: false, whatsapp: false, push: true }), [
    "inApp",
    "email",
    "push"
  ]);
  assert.equal(passwordChangeError({ current: "", next: "longenough", confirm: "longenough" }), "Enter your current password.");
  assert.equal(passwordChangeError({ current: "old", next: "short", confirm: "short" }), "New password must be at least 8 characters.");
  assert.equal(passwordChangeError({ current: "old", next: "longenough", confirm: "other" }), "New password and confirmation do not match.");
  assert.equal(passwordChangeError({ current: "old", next: "longenough", confirm: "longenough" }), null);
  assert.equal(settingsAdminShortcuts("TECHNICIAN").length, 0);
  assert.deepEqual(
    settingsAdminShortcuts("ADMIN").map((link) => link.href),
    ["/admin", "/admin/users", "/admin/roles", "/admin/organization"]
  );
  assert.equal(settingsAdminShortcuts("SUPER_ADMIN").some((link) => link.href === "/system-health"), true);
});
