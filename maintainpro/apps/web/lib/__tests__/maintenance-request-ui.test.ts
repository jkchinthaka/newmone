import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  actionBlockedReason,
  isActionAllowed,
  isRequestStage,
  requestHistoryActionLabel,
  requestNextStep,
  requestResultCountLabel,
  requestStageCards,
  requestStatusLabel,
  requestTriageExplanation,
  requestValueLabel,
  requesterFacingStatus,
  requestTrackerIndex,
  resolveRequestMenuActivation
} from "../maintenance-request-ui";
import { getVisibleNavigationItems, isNavItemActive, NAVIGATION_ITEMS, REQUEST_LIST_PERMISSIONS } from "../navigation";

describe("maintenance request labels", () => {
  it("uses business wording instead of raw codes", () => {
    assert.equal(requestStatusLabel("APPROVED"), "Accepted");
    assert.equal(requestStatusLabel("CONVERTED_TO_WO"), "Job created");
    assert.match(requestTriageExplanation(), /Needs Information/);
    assert.match(requestTriageExplanation(), /Accepted requests stay on All requests/);
    assert.equal(requestHistoryActionLabel("START_REVIEW"), "Review started");
    assert.equal(requestHistoryActionLabel("CONVERTED_TO_WO"), "Job created");
    assert.equal(requestValueLabel("VERY_URGENT"), "Very urgent");
    assert.equal(requestValueLabel("NOT_SURE"), "Not sure");
  });

  it("falls back to readable text for unknown codes", () => {
    assert.equal(requestHistoryActionLabel("SOME_NEW_EVENT"), "Some New Event");
    assert.equal(requestValueLabel(null), "—");
  });
});

describe("server-computed request actions", () => {
  const actions = {
    approve: { allowed: false, reason: "Confirm the target first." },
    cancel: { allowed: true }
  };

  it("only treats an action as available when the server allows it", () => {
    assert.equal(isActionAllowed(actions, "cancel"), true);
    assert.equal(isActionAllowed(actions, "approve"), false);
    assert.equal(isActionAllowed(actions, "convert"), false);
    assert.equal(isActionAllowed(undefined, "cancel"), false);
  });

  it("surfaces the block reason so the UI explains instead of failing with 403", () => {
    assert.equal(actionBlockedReason(actions, "approve"), "Confirm the target first.");
    assert.equal(actionBlockedReason(actions, "cancel"), null);
    assert.equal(actionBlockedReason(actions, "convert"), null);
  });
});

describe("requestNextStep", () => {
  it("tells a reviewer to confirm the target when it is unresolved", () => {
    const step = requestNextStep({
      status: "UNDER_REVIEW",
      targetUnresolved: true,
      isOwner: false,
      allowedActions: { triage: { allowed: true }, approve: { allowed: false, reason: "x" } }
    });
    assert.equal(step.tone, "blocked");
    assert.match(step.title, /target/i);
  });

  it("asks the owner to answer when information is needed", () => {
    const step = requestNextStep({
      status: "NEEDS_INFORMATION",
      isOwner: true,
      allowedActions: { respond: { allowed: true } }
    });
    assert.equal(step.title, "Your answer is needed");
  });

  it("does not claim the viewer can act when the server says they cannot", () => {
    const step = requestNextStep({ status: "APPROVED", isOwner: false, allowedActions: {} });
    assert.equal(step.tone, "waiting");
  });

  it("does not call technician completion a resolved request", () => {
    assert.equal(requesterFacingStatus("CONVERTED_TO_WO", "TECHNICIAN_COMPLETED"), "Work done — waiting for supervisor check");
    assert.equal(requesterFacingStatus("CONVERTED_TO_WO", "IN_PROGRESS"), "Maintenance In Progress");
    assert.equal(requesterFacingStatus("CONVERTED_TO_WO", "OPEN"), "Accepted / Scheduled");
    assert.equal(requesterFacingStatus("CONVERTED_TO_WO", "VERIFIED"), "Resolved / Completed");
    assert.equal(requesterFacingStatus("CLOSED"), "Closed Without Work");
    assert.equal(requesterFacingStatus("CANCELLED"), "Cancelled");
    assert.equal(requesterFacingStatus("NEW"), "Submitted");
  });

  it("tells the requester the linked work is still awaiting supervisor check", () => {
    const step = requestNextStep({
      status: "CONVERTED_TO_WO",
      isOwner: true,
      workOrder: { woNumber: "WO-2026-0042", status: "TECHNICIAN_COMPLETED" }
    });
    assert.equal(step.title, "Work done — waiting for supervisor check");
    assert.equal(step.tone, "waiting");
  });
  it("points a reviewer at the job once converted", () => {
    const step = requestNextStep({
      status: "CONVERTED_TO_WO",
      isOwner: false,
      workOrder: { woNumber: "WO-2026-0042" }
    });
    assert.equal(step.title, "Job WO-2026-0042");
  });
});

describe("request stage cards", () => {
  it("maps each summary counter to the list stage with the same predicate", () => {
    const cards = requestStageCards({ open: 5, awaitingTriage: 2, highCritical: 1, converted: 9 });
    assert.deepEqual(
      cards.map((card) => [card.stage, card.value]),
      [
        ["open", 5],
        ["awaiting_triage", 2],
        ["urgent", 1],
        ["converted", 9]
      ]
    );
    for (const card of cards) assert.equal(isRequestStage(card.stage), true);
    assert.equal(isRequestStage("bogus"), false);
  });

  it("pluralizes the filtered count with matches for one request", () => {
    assert.equal(requestResultCountLabel(2, false), "2 requests");
    assert.equal(requestResultCountLabel(1, true), "1 request matches this view");
    assert.equal(requestResultCountLabel(0, true), "0 requests match this view");
  });
});

describe("Requests navigation visibility", () => {
  const hasRequests = (role: string, permissions: string[]) =>
    getVisibleNavigationItems(role, { permissions }).some((item) => item.id === "requests");

  it("shows Requests to roles holding the list permission", () => {
    assert.equal(hasRequests("MANAGER", ["maintenance_requests.view_own"]), true);
    assert.equal(hasRequests("VIEWER", ["facility_issues.view"]), true);
    assert.equal(hasRequests("ADMIN", []), true);
  });

  it("hides Requests when the account has no request permission", () => {
    assert.equal(hasRequests("TECHNICIAN", ["work_orders.view_own", "work_orders.update_status"]), false);
    assert.equal(hasRequests("FINANCE", ["reports.view"]), false);
    assert.equal(hasRequests("SECURITY_OFFICER", []), false);
  });

  it("shows Requests to an authorized employee in any department role", () => {
    assert.equal(hasRequests("FINANCE", ["maintenance_requests.view_own"]), true);
    assert.equal(hasRequests("FARM_WORKER", ["maintenance_requests.view_own"]), true);
    assert.equal(hasRequests("SALES", ["maintenance_requests.create", "maintenance_requests.view_own"]), true);
    assert.equal(hasRequests("SECURITY_OFFICER", [...REQUEST_LIST_PERMISSIONS]), true);
  });

  it("shows one Requests entry per person", () => {
    const ids = (role: string, permissions: string[]) => getVisibleNavigationItems(role, { permissions }).map((item) => item.id);
    // My requests is a tab inside Requests, so it is never a second menu entry.
    for (const [role, keys] of [
      ["SALES", ["maintenance_requests.create", "maintenance_requests.view_own"]],
      ["SECURITY_OFFICER", ["maintenance_requests.create"]],
      ["INVENTORY_KEEPER", ["maintenance_requests.create"]],
      ["MANAGER", ["maintenance_requests.create", "maintenance_requests.view_own", "maintenance_requests.view_all", "maintenance_requests.triage"]],
      ["ADMIN", []]
    ] as const) {
      const visible = ids(role, [...keys]);
      assert.equal(visible.filter((id) => id === "requests" || id === "my-requests").length, 1, role);
    }
    const label = (role: string, permissions: string[]) =>
      getVisibleNavigationItems(role, { permissions }).find((item) => item.id === "requests")?.label;
    assert.equal(label("SECURITY_OFFICER", ["maintenance_requests.create"]), "My Requests");
    assert.equal(label("MANAGER", ["maintenance_requests.view_own", "maintenance_requests.triage"]), "Requests");
    const requests = NAVIGATION_ITEMS.find((item) => item.id === "requests");
    const report = NAVIGATION_ITEMS.find((item) => item.id === "report-issue");
    assert.equal(requests && isNavItemActive("/requests/mine", requests), true);
    assert.equal(report && isNavItemActive("/requests/new", report), true);
    assert.equal(requests && isNavItemActive("/requests/new", requests), false);
  });

  it("offers Report issue to everyone who can create a request, technicians included", () => {
    const has = (role: string, permissions: string[]) =>
      getVisibleNavigationItems(role, { permissions }).some((item) => item.id === "report-issue");
    assert.equal(has("TECHNICIAN", ["work_orders.view_own", "maintenance_requests.create", "maintenance_requests.view_own"]), true);
    assert.equal(has("SECURITY_OFFICER", ["maintenance_requests.create"]), true);
    assert.equal(has("FINANCE", ["maintenance_requests.view_own"]), false);
  });
});

describe("request action menu activation", () => {
  it("opens a request by route and does not also run a command", () => {
    const plan = resolveRequestMenuActivation({ href: "/requests/req-1" });
    assert.equal(plan.closeMenu, true);
    assert.equal(plan.navigateTo, "/requests/req-1");
    assert.equal(plan.runCommand, false);
  });

  it("runs cancel as a command so the reason prompt can open", () => {
    const plan = resolveRequestMenuActivation({});
    assert.equal(plan.closeMenu, true);
    assert.equal(plan.navigateTo, null);
    assert.equal(plan.runCommand, true);
  });
});

describe("request tracker", () => {
  it("moves from submitted to done using the request and the job", () => {
    assert.equal(requestTrackerIndex("NEW", null), 0);
    assert.equal(requestTrackerIndex("APPROVED", null), 1);
    assert.equal(requestTrackerIndex("CONVERTED_TO_WO", "ASSIGNED"), 1);
    assert.equal(requestTrackerIndex("CONVERTED_TO_WO", "IN_PROGRESS"), 2);
    assert.equal(requestTrackerIndex("CONVERTED_TO_WO", "CLOSED"), 3);
    assert.equal(requestTrackerIndex("CANCELLED", "CLOSED"), 0);
  });
});
