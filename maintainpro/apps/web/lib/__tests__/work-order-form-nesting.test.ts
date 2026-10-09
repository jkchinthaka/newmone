import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(__dirname, "../../components/work-orders");

test("assignment controls are not a form nested inside the work order editor form", () => {
  const editor = fs.readFileSync(path.join(root, "work-order-editor-modal.tsx"), "utf8");
  const assignees = fs.readFileSync(path.join(root, "work-order-assignees-panel.tsx"), "utf8");
  const editorForms = editor.match(/<form[\s>]/g) ?? [];
  assert.equal(editorForms.length, 1);
  assert.equal(editor.includes("<WorkOrderAssigneesPanel"), true);
  assert.equal(/<form[\s>]/.test(assignees), false);
  assert.match(assignees, /type="button"/);
  assert.match(assignees, /void handleAdd\(\)/);
});
