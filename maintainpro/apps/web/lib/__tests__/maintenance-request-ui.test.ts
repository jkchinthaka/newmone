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
  requestValueLabel
} from "../maintenance-request-ui";
import { getVisibleNavigationItems, REQUEST_LIST_PERMISSIONS } from "../navigation";

describe("maintenance request labels", () => {
  it("uses business wording instead of raw codes", () => {
    assert.equal(requestStatusLabel("APPROVED"), "Accepted");
    assert.equal(requestStatusLabel("CONVERTED_TO_WO"), "Converted to Work Order");
    assert.equal(requestHistoryActionLabel("START_REVIEW"), "Review started");
    assert.equal(requestHistoryActionLabel("CONVERTED_TO_WO"), "Work order created");
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

  it("points to the work order once converted", () => {
    const step = requestNextStep({
      status: "CONVERTED_TO_WO",
      isOwner: false,
      workOrder: { woNumber: "WO-2026-0042" }
    });
    assert.equal(step.title, "Work order WO-2026-0042");
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

  it("hides Requests from roles the API would reject", () => {
    // Seeded TECHNICIAN has no request permission: the list endpoint returns 403.
    assert.equal(hasRequests("TECHNICIAN", ["work_orders.view_own", "work_orders.update_status"]), false);
    // SECURITY_OFFICER is not in the API read roles at all.
    assert.equal(hasRequests("SECURITY_OFFICER", [...REQUEST_LIST_PERMISSIONS]), false);
  });
});
