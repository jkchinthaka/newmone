import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { EMPTY_ASSET_REGISTER_FORM, assetRegisterPayload, assetRegisterStepIssues } from "../asset-register-flow";
import { canEditJobDetails } from "../work-order-edit-rights";

test("only Admin and Super Admin edit job details after creation", () => {
  assert.equal(canEditJobDetails("ADMIN"), true);
  assert.equal(canEditJobDetails("SUPER_ADMIN"), true);
  for (const role of ["MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR", "TECHNICIAN", null]) {
    assert.equal(canEditJobDetails(role), false);
  }
  const editor = readFileSync("components/work-orders/work-order-editor-modal.tsx", "utf8");
  assert.match(editor, /readOnly=\{!detailsEditable\}/);
  assert.match(editor, /Only an Admin can change the title, description, cost and hours/);
});

test("register flow: each step blocks until its required fields are filled", () => {
  const form = { ...EMPTY_ASSET_REGISTER_FORM };
  assert.deepEqual(assetRegisterStepIssues(0, form), ["Choose what you are registering."]);
  assert.ok(assetRegisterStepIssues(1, { ...form, name: "Filler", assetTag: "MCH-1" }).some((issue) => /AST-MCH0001/.test(issue)));
  assert.deepEqual(assetRegisterStepIssues(1, { ...form, name: "Filler", assetTag: "ast-mch0001" }), []);
  assert.deepEqual(assetRegisterStepIssues(2, form), ["Choose the site where it is."]);
  assert.ok(assetRegisterStepIssues(3, { ...form, purchaseDate: "2026-05-01", warrantyExpiry: "2026-01-01" }).length > 0);
});

test("register flow saves a Draft with only the filled fields", () => {
  const payload = assetRegisterPayload({ ...EMPTY_ASSET_REGISTER_FORM, category: "MACHINE", name: " Filler ", assetTag: "ast-mch0001", siteId: "s1", purchasePrice: "1500" });
  assert.equal(payload.status, "DRAFT");
  assert.equal(payload.assetTag, "AST-MCH0001");
  assert.equal(payload.name, "Filler");
  assert.equal(payload.purchasePrice, 1500);
  assert.equal(payload.manufacturer, undefined);
  const table = readFileSync("components/assets/assets-table.tsx", "utf8");
  assert.match(table, /Approve — make Active/);
});
