import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const source = readFileSync(
  path.resolve(__dirname, "../../components/work-orders/work-order-mobile-card-list.tsx"),
  "utf8"
);

test("mobile work-order card always renders the Open/View button, even next to an action", () => {
  const openIndex = source.indexOf("aria-label={`Open ${row.woNumber}`}");
  assert.notEqual(openIndex, -1, "View button with Open aria-label is missing");
  const actionIndex = source.indexOf('control.kind === "action"');
  assert.notEqual(actionIndex, -1);
  // The Open button must not sit in the else branch of the action ternary.
  const between = source.slice(actionIndex, openIndex);
  assert.match(between, /\) : null\}/, "Open button must render outside the action ternary");
});
