import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const page = readFileSync(path.resolve(__dirname, "../../app/(dashboard)/vehicles/page.tsx"), "utf8");

test("Vehicles: sort and rows-per-page sit under More options; search and status chips stay up front", () => {
  const more = page.indexOf("More options (sort, rows per page)");
  assert.ok(more > 0);
  assert.ok(page.indexOf(">Sort By<") > more);
  assert.ok(page.indexOf(">Rows<") > more);
  assert.ok(page.indexOf('placeholder="Registration number or model"') < more);
  assert.ok(page.indexOf("VEHICLE_STATUSES.map((status) => {\n            const active") > more);
});

test("Vehicles: no future-feature placeholder cards, exports kept, plain Add vehicle wording", () => {
  assert.doesNotMatch(page, /FutureFeatureCard/);
  assert.doesNotMatch(page, /Register in Admin/);
  assert.match(page, /Add vehicle/);
  for (const label of ["Export CSV", "Export Excel", "Export PDF"]) assert.ok(page.includes(label), label);
});
