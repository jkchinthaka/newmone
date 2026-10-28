import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  buildCompletionChecklist,
  clearCompletionDraft,
  completionBlockReason,
  readCompletionDraft,
  saveCompletionDraft
} from "../work-order-completion-checklist";
import {
  canOverrideQrMismatch,
  defaultEvidenceType,
  evidenceTypeAfterUpload,
  isQrMismatchMessage,
  qrStatusLabel,
  type WorkOrderEvidenceRequirements
} from "../work-order-evidence";
import {
  canPartRequestAction,
  partLineStatusLabel,
  partRequestNextStep,
  partRequestStatusLabel
} from "../part-request-ui";
import { buildHoldPayload, MY_JOB_HOLD_CHOICES, sentBackLabel, validateHoldNote } from "../my-job-hold";

const read = (relative: string) => readFileSync(path.resolve(__dirname, relative), "utf8");
const modal = read("../../components/work-orders/complete-work-order-modal.tsx");
const evidencePanel = read("../../components/work-orders/work-order-evidence-panel.tsx");
const partsPanel = read("../../components/work-orders/part-requests-panel.tsx");
const myJobs = read("../../app/(dashboard)/work-orders/my/page.tsx");

function requirements(overrides: Partial<WorkOrderEvidenceRequirements> = {}): WorkOrderEvidenceRequirements {
  return {
    required: true,
    storageEnabled: true,
    waived: false,
    hasBefore: false,
    hasAfter: false,
    beforeCount: 0,
    afterCount: 0,
    missingBefore: true,
    missingAfter: true,
    complete: false,
    rejectedCount: 0,
    completionNoteProvided: false,
    qrVerificationStatus: "PENDING",
    qrRequired: true,
    ...overrides
  };
}

test("completion checklist lists every server check with plain help", () => {
  const items = buildCompletionChecklist({
    requirements: requirements(),
    partLines: [{ issuedQuantity: 2 }],
    partsSummary: { unaccountedLines: 1 },
    isVehicle: true,
    odometer: ""
  });
  assert.deepEqual(
    items.map((item) => [item.key, item.met]),
    [
      ["before", false],
      ["after", false],
      ["qr", false],
      ["parts", false],
      ["odometer", false]
    ]
  );
  assert.equal(items.find((item) => item.key === "before")?.help, "Open the photos tab and add a before photo.");
  assert.equal(items.find((item) => item.key === "parts")?.tab, "parts");
  assert.match(completionBlockReason(items) ?? "", /^Cannot submit yet\. Open the photos tab and add a before photo\. 4 more items/);
});

test("completion checklist hides lines that do not apply and unblocks when done", () => {
  const items = buildCompletionChecklist({
    requirements: requirements({ hasBefore: true, hasAfter: true, qrRequired: false }),
    partLines: [{ issuedQuantity: 0 }],
    partsSummary: { unaccountedLines: 0 },
    isVehicle: false,
    odometer: ""
  });
  assert.deepEqual(items.map((item) => item.key), ["before", "after"]);
  assert.equal(completionBlockReason(items), null);

  const waived = buildCompletionChecklist({
    requirements: requirements({ waived: true, qrRequired: false }),
    partLines: null,
    partsSummary: null,
    isVehicle: true,
    odometer: "12500"
  });
  assert.deepEqual(waived.map((item) => [item.key, item.met]), [["odometer", true]]);
});

test("QR overridden counts as done; storage-off blocks with admin help", () => {
  const items = buildCompletionChecklist({
    requirements: requirements({ storageUnavailableBlocking: true, qrVerificationStatus: "OVERRIDDEN" }),
    partLines: [],
    partsSummary: { unaccountedLines: 0 },
    isVehicle: false,
    odometer: ""
  });
  assert.deepEqual(items.map((item) => [item.key, item.met]), [["storage", false], ["qr", true]]);
  assert.match(items[0].help, /Ask your administrator/);
});

test("completion draft survives close/reopen for the same job and status only", () => {
  saveCompletionDraft("wo-1", "IN_PROGRESS", { completionNote: "Changed belt" });
  assert.deepEqual(readCompletionDraft("wo-1", "IN_PROGRESS"), { completionNote: "Changed belt" });
  assert.equal(readCompletionDraft("wo-2", "IN_PROGRESS"), null);
  // Status moved on (submitted, sent back): old note must not come back.
  assert.equal(readCompletionDraft("wo-1", "REWORK_REQUIRED"), null);
  assert.equal(readCompletionDraft("wo-1", "IN_PROGRESS"), null);
  saveCompletionDraft("wo-3", "IN_PROGRESS", { completionNote: "x" });
  clearCompletionDraft("wo-3");
  assert.equal(readCompletionDraft("wo-3", "IN_PROGRESS"), null);
});

test("completion modal shows checklist, loads existing endpoints, keeps typed fields", () => {
  assert.match(modal, /Before you submit/);
  assert.match(modal, /apiClient\.get\(`\/work-orders\/\$\{id\}\/evidence`\)/);
  assert.match(modal, /listWorkOrderPartLines\(id\)/);
  assert.match(modal, /getWorkOrderPartsSummary\(id\)/);
  assert.match(modal, /disabled=\{submitting \|\| Boolean\(blockReason\)\}/);
  assert.match(modal, /\{blockReason\}/);
  assert.match(modal, /readCompletionDraft<CompletionDraftValues>\(workOrderId, workOrderStatus\)/);
  assert.doesNotMatch(modal, /setCompletionNote\(""\)/);
});

test("photos type moves to After once a before photo exists or was just uploaded", () => {
  assert.equal(defaultEvidenceType([]), "BEFORE_PHOTO");
  assert.equal(defaultEvidenceType([{ evidenceType: "BEFORE_PHOTO", status: "UPLOADED" }]), "AFTER_PHOTO");
  assert.equal(defaultEvidenceType([{ evidenceType: "BEFORE_PHOTO", status: "FAILED" }]), "BEFORE_PHOTO");
  assert.equal(evidenceTypeAfterUpload("BEFORE_PHOTO"), "AFTER_PHOTO");
  assert.equal(evidenceTypeAfterUpload("INVOICE"), "INVOICE");
  assert.match(evidencePanel, /Add before photo/);
  assert.match(evidencePanel, /Add after photo/);
  assert.match(evidencePanel, /setEvidenceType\(evidenceTypeAfterUpload\(evidenceType\)\)/);
  assert.doesNotMatch(evidencePanel, /useState\("BEFORE_PHOTO"\)/);
});

test("QR camera scan verifies at once; override only for roles allowed by both API gates", () => {
  for (const role of ["SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER"]) {
    assert.equal(canOverrideQrMismatch(role), true, role);
  }
  // OPERATIONS_MANAGER / SUPERVISOR are in QR_OVERRIDE_ROLES but not in verify-qr @Roles.
  for (const role of ["TECHNICIAN", "MECHANIC", "OPERATIONS_MANAGER", "SUPERVISOR", "INVENTORY_KEEPER", "SECURITY_OFFICER", null]) {
    assert.equal(canOverrideQrMismatch(role), false, String(role));
  }
  assert.equal(isQrMismatchMessage("Scanned asset does not match this job."), true);
  assert.equal(qrStatusLabel("VERIFIED"), "Tag checked. This is the right asset.");
  assert.match(qrStatusLabel("PENDING"), /Not checked yet/);
  assert.match(evidencePanel, /onScan=\{\(value\) => \{[\s\S]*?void verifyQr\(value\);/);
  assert.match(evidencePanel, /placeholder="Vehicle number or asset tag"/);
  assert.match(evidencePanel, /Tag missing or damaged\?/);
  assert.match(evidencePanel, /verifyQr\(qrMismatchValue, qrOverrideReason\)/);
  assert.match(evidencePanel, /overrideReason: overrideReason\?\.trim\(\) \|\| undefined/);
  assert.match(evidencePanel, /Ask a manager to confirm this job\./);
});

test("parts panel shows plain status words and hides buttons a role cannot use", () => {
  assert.equal(partRequestStatusLabel("PENDING_OPERATIONAL"), "Waiting for manager approval");
  assert.equal(partRequestStatusLabel("APPROVED"), "Ready to issue");
  assert.equal(partRequestStatusLabel("ISSUED"), "Issued");
  assert.equal(partRequestStatusLabel("REJECTED"), "Rejected");
  assert.equal(partLineStatusLabel("PARTIALLY_USED"), "Part used");
  assert.equal(partRequestNextStep("PENDING_OPERATIONAL"), "A manager must approve this request.");
  assert.equal(canPartRequestAction("TECHNICIAN", "approve_operational"), false);
  assert.equal(canPartRequestAction("TECHNICIAN", "create"), true);
  assert.equal(canPartRequestAction("INVENTORY_KEEPER", "issue"), true);
  assert.equal(canPartRequestAction("INVENTORY_KEEPER", "reject"), false);
  assert.equal(canPartRequestAction("MANAGER", "issue"), true);
  assert.doesNotMatch(partsPanel, /title=\{/);
  assert.doesNotMatch(partsPanel, /pr\.status\.replace\(/);
  assert.doesNotMatch(partsPanel, /line\.lineStatus\.replace\(/);
  assert.doesNotMatch(partsPanel, /3–4\.|5\. Cost/);
  assert.match(partsPanel, /\{showApprove \? \(/);
});

test("My jobs hold asks for a reason choice and a note of 3+ letters", () => {
  assert.deepEqual(
    MY_JOB_HOLD_CHOICES.map((choice) => choice.code),
    ["WAITING_PARTS", "WAITING_APPROVAL", "OTHER"]
  );
  assert.equal(validateHoldNote(""), "Write a short note.");
  assert.equal(validateHoldNote(" ab "), "Write at least 3 letters.");
  assert.equal(validateHoldNote("pump seal"), null);
  assert.deepEqual(buildHoldPayload("WAITING_PARTS", "  seal kit ", 4), {
    holdReasonCode: "WAITING_PARTS",
    delayReason: "seal kit",
    expectedVersion: 4
  });
  assert.doesNotMatch(myJobs, /holdReasonCode: "OTHER"/);
  assert.match(myJobs, /buildHoldPayload\(code, note, job\.version\)/);
  assert.match(myJobs, /validateHoldNote\(note\)/);
});

test("My jobs card shows why a job was sent back", () => {
  assert.equal(
    sentBackLabel({ status: "REWORK_REQUIRED", verificationRejectionReason: " Belt still loose " }),
    "Sent back: Belt still loose"
  );
  assert.match(sentBackLabel({ status: "REWORK_REQUIRED", verificationRejectionReason: null }) ?? "", /Sent back by supervisor/);
  assert.equal(sentBackLabel({ status: "IN_PROGRESS", verificationRejectionReason: "old" }), null);
  assert.match(myJobs, /sentBackLabel\(job\)/);
});
