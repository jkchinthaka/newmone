import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = path.dirname(fileURLToPath(import.meta.url));
const layoutDir = path.resolve(here, "../../components/layout");
const drawer = readFileSync(path.join(layoutDir, "mobile-nav.tsx"), "utf8");
const bottom = readFileSync(path.join(layoutDir, "mobile-bottom-nav.tsx"), "utf8");
const trap = readFileSync(path.resolve(here, "../use-focus-trap.ts"), "utf8");

function zIndex(source: string, marker: string): number {
  const at = source.indexOf(marker);
  assert.notEqual(at, -1, marker);
  const match = source.slice(at, at + 180).match(/\bz-(\d+)\b/);
  assert.ok(match, `z-index near ${marker}`);
  return Number(match[1]);
}

test("the mobile menu stacks above the bottom navigation bar", () => {
  const drawerZ = zIndex(drawer, "fixed inset-0");
  const bottomZ = zIndex(bottom, "fixed inset-x-0 bottom-0");
  assert.ok(drawerZ > bottomZ);
  assert.equal(drawerZ, 50);
  assert.equal(bottomZ, 40);
});

test("mobile menu links stay reachable and the menu closes without leaving the page locked", () => {
  assert.match(drawer, /role="dialog"/);
  assert.match(drawer, /aria-modal="true"/);
  assert.match(drawer, /aria-label="Mobile navigation"/);
  assert.match(drawer, /aria-label="Close navigation menu"/);
  assert.match(drawer, /<NavLinks onNavigate=\{onClose\} \/>/);
  assert.match(drawer, /useFocusTrap\(open, panelRef, \{ onEscape: onEscape \?\? onClose \}\)/);
  assert.equal(drawer.includes("document.body.style.overflow"), false);
  assert.match(drawer, /if \(!open\) \{\s*return null;/);
  assert.match(bottom, /<Link/);
  assert.match(trap, /a\[href\], button:not\(\[disabled\]\)/);
  assert.match(trap, /event\.key === "Escape"/);
  assert.match(trap, /previous\?\.focus\?\.\(\)/);
  assert.match(trap, /unlockScroll\(binding\.body\)/);
});
