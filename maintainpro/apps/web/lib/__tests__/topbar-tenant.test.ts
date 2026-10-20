import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = path.dirname(fileURLToPath(import.meta.url));
const layoutDir = path.resolve(here, "../../components/layout");
const topbar = readFileSync(path.join(layoutDir, "topbar.tsx"), "utf8");
const mobileNav = readFileSync(path.join(layoutDir, "mobile-nav.tsx"), "utf8");

test("the topbar renders no tenant select", () => {
  assert.equal(topbar.includes("<select"), false);
  assert.equal(topbar.includes("Switch organization"), false);
  assert.equal(mobileNav.includes("<select"), false);
  assert.equal(mobileNav.includes("Switch organization"), false);
});
