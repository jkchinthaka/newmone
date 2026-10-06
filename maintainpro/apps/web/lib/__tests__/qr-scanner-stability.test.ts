import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

/**
 * Regression guard for Report Issue (/requests/new) "Maximum update depth exceeded".
 * Root cause: QrScanner's camera effect depended on `onScan`, and the page passed an
 * inline callback that changed every keystroke in Description — re-running setState
 * while closed. The component must keep onScan in a ref and only reset state on
 * open→closed transitions.
 */
const source = readFileSync(
  path.join(__dirname, "../../components/qr/qr-scanner.tsx"),
  "utf8"
);

test("QrScanner keeps onScan in a ref instead of effect dependencies", () => {
  assert.match(source, /onScanRef/);
  assert.match(source, /onScanRef\.current\s*=\s*onScan/);
  assert.doesNotMatch(source, /\[emitScan,\s*open,\s*regionId,\s*stopScanner,\s*onScan\]/);
});

test("QrScanner only resets UI state on open→closed transitions", () => {
  assert.match(source, /prevOpenRef/);
  assert.match(source, /if\s*\(wasOpen\)/);
  assert.match(source, /Only reset UI state when transitioning open→closed/);
});

test("QrScanner emitScan reads onScan through the ref", () => {
  assert.match(source, /onScanRef\.current\(value\)/);
  assert.doesNotMatch(source, /void stopScanner\(\)\.then\(\(\)\s*=>\s*onScan\(value\)\)/);
});
