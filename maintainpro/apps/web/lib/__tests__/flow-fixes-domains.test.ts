import test from "node:test";
import assert from "node:assert/strict";

import { needsPlace, getAssetLabel } from "../../components/work-orders/helpers";
import { requestNextStep } from "../maintenance-request-ui";
import { notificationContextHref } from "../notification-inbox";
import {
  awaitingRequesterConfirmation,
  canAnswerConfirmation,
  confirmationAnsweredLabel,
  confirmationIssues
} from "../requester-confirmation";
import { serviceDueText, serviceJobPayload, type VehicleServiceDueRow } from "../vehicle-jobs-overview";

test("is it fixed: shown only while the verified job waits for the reporter", () => {
  const waiting = { status: "VERIFIED", requesterConfirmationStatus: "PENDING" };
  assert.equal(awaitingRequesterConfirmation(waiting), true);
  assert.equal(awaitingRequesterConfirmation({ status: "VERIFIED", requesterConfirmationStatus: "NOT_REQUIRED" }), false);
  assert.equal(canAnswerConfirmation({ workOrder: waiting, isOwner: false, canReview: false }), false);
  assert.equal(canAnswerConfirmation({ workOrder: waiting, isOwner: true, canReview: false }), true);
  assert.equal(confirmationIssues(true, ""), null);
  assert.match(confirmationIssues(false, "no") ?? "", /what is still wrong/);
  assert.equal(confirmationIssues(false, "Still leaking"), null);
  assert.match(confirmationAnsweredLabel({ requesterConfirmationOutcome: "UNRESOLVED" }) ?? "", /not fixed/);
  const step = requestNextStep({
    status: "CONVERTED_TO_WO",
    isOwner: true,
    workOrder: { woNumber: "WO-9", status: "VERIFIED", requesterConfirmationStatus: "PENDING" }
  });
  assert.equal(step.title, "Please confirm it is fixed");
});

test("jobs with no machine, vehicle or place are flagged", () => {
  const base = { status: "OPEN", assetId: null, vehicleId: null, functionalLocationId: null } as never;
  assert.equal(needsPlace(base), true);
  assert.equal(getAssetLabel({ ...(base as object), status: "OPEN" } as never), "Place needed");
  assert.equal(needsPlace({ ...(base as object), status: "CLOSED" } as never), false);
  assert.equal(
    getAssetLabel({ ...(base as object), functionalLocationId: "fl", functionalLocation: { name: "Boiler room", code: "BR-1" } } as never),
    "Boiler room (BR-1)"
  );
  assert.equal(
    getAssetLabel({ ...(base as object), vehicleId: "v", vehicle: { id: "v", registrationNo: "WP-1234", make: "Isuzu", vehicleModel: "NPR" } } as never),
    "WP-1234 · Isuzu NPR"
  );
});

test("vehicle service due text and service job body", () => {
  assert.equal(serviceDueText({ daysLeft: -3, kmLeft: -420 }), "3 days late · 420 km over");
  assert.equal(serviceDueText({ daysLeft: 5, kmLeft: null }), "in 5 days");
  const row: VehicleServiceDueRow = {
    vehicleId: "v-1",
    registrationNo: "WP-1234",
    makeModel: "Isuzu NPR",
    driverName: null,
    vehicleStatus: "AVAILABLE",
    currentMileage: 40200,
    nextServiceDate: null,
    nextServiceMileage: 40000,
    state: "OVERDUE",
    daysLeft: null,
    kmLeft: -200,
    openServiceJob: null
  };
  const body = serviceJobPayload(row, "u-1");
  assert.equal(body.jobDomain, "VEHICLE");
  assert.equal(body.type, "PREVENTIVE");
  assert.equal(body.currentOdometer, 40200);
  assert.equal(body.priority, "HIGH");
});

test("reminder notifications open the request or permits page", () => {
  assert.equal(notificationContextHref({ referenceType: "MaintenanceRequest", referenceId: "r-1" }), "/requests/r-1");
  assert.equal(notificationContextHref({ referenceType: "WorkPermit", referenceId: "p-1" }), "/admin/work-permits");
});
