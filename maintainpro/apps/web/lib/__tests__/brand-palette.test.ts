import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(__dirname, "../..");
const tailwind = readFileSync(path.join(root, "tailwind.config.ts"), "utf8");
const css = readFileSync(path.join(root, "app/globals.css"), "utf8");
const layout = readFileSync(path.join(root, "app/(dashboard)/layout.tsx"), "utf8");

test("Nelna palette: sidebar #103D2D, primary #166534, accent #F4C542, page #F8FAFC, text #1E293B", () => {
  assert.match(tailwind, /900: "#103D2D"/); // sidebar uses brand-900
  assert.match(tailwind, /600: "#166534"/); // primary buttons use brand-600
  assert.match(tailwind, /500: "#F4C542"/);
  assert.match(tailwind, /page: "#F8FAFC"/);
  assert.match(tailwind, /ink: "#1E293B"/);
  assert.match(css, /--nelna-green: #166534/);
  assert.match(css, /--page-bg: #f8fafc/);
  assert.match(css, /--nelna-charcoal: #1e293b/);
});

test("Dashboard pages sit on the #F8FAFC page background, and the sidebar still uses brand-900", () => {
  assert.match(layout, /bg-page/);
  assert.doesNotMatch(layout, /<main[^>]*bg-brand-50/);
  assert.match(readFileSync(path.join(root, "components/layout/sidebar.tsx"), "utf8"), /bg-brand-900/);
});
