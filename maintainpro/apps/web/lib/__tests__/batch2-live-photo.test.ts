import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { fitWithin, isLivePhotoEvidenceType } from "../work-order-photo-upload";
import { WORK_ORDER_DRAWER_STEPS, WORK_ORDER_STEP_HELP } from "../work-order-drawer-display";

test("camera frames are scaled down to 1600 px on the long side, never up", () => {
  assert.deepEqual(fitWithin(4000, 3000), { width: 1600, height: 1200 });
  assert.deepEqual(fitWithin(1080, 1920), { width: 900, height: 1600 });
  assert.deepEqual(fitWithin(800, 600), { width: 800, height: 600 });
});

test("photo evidence types use the live camera; documents may still be files", () => {
  for (const type of ["BEFORE_PHOTO", "AFTER_PHOTO", "DAMAGE_PHOTO", "PART_PHOTO"]) assert.equal(isLivePhotoEvidenceType(type), true);
  for (const type of ["INVOICE", "QUOTATION", "OTHER_DOCUMENT"]) assert.equal(isLivePhotoEvidenceType(type), false);
});

test("the live camera has no file input, so saved pictures cannot be chosen", () => {
  const camera = readFileSync("components/evidence/live-camera-capture.tsx", "utf8");
  assert.doesNotMatch(camera, /type="file"/);
  assert.match(camera, /getUserMedia/);
  assert.match(camera, /facingMode/);
});

test("Start opens the before-photo dialog in My Jobs and the jobs list (resume does not)", () => {
  const myJobs = readFileSync("app/(dashboard)/work-orders/my/page.tsx", "utf8");
  assert.match(myJobs, /<StartJobDialog/);
  assert.doesNotMatch(myJobs, /apiClient\.post\(`\/work-orders\/\$\{job\.id\}\/start`/);
  const list = readFileSync("components/work-orders/work-orders-page.tsx", "utf8");
  assert.match(list, /status === "IN_PROGRESS" && workOrder\.status !== "ON_HOLD" && !workOrder\.startDate/);
  const dialog = readFileSync("components/work-orders/start-job-dialog.tsx", "utf8");
  assert.match(dialog, /evidenceType: "BEFORE_PHOTO"/);
  assert.match(dialog, /source: "LIVE_CAMERA"/);
  assert.match(dialog, /START_PHOTO_REQUIRED/);
});

test("every job shows the same six-step flow with a one-line next step", () => {
  assert.deepEqual([...WORK_ORDER_DRAWER_STEPS], ["New", "Assigned", "Working", "Done", "Supervisor check", "Closed"]);
  for (const step of WORK_ORDER_DRAWER_STEPS) assert.ok(WORK_ORDER_STEP_HELP[step].length > 0);
});
