import assert from "node:assert/strict";
import test from "node:test";

import {
  DEPARTMENTS_HREF,
  ORG_LOCATIONS_EMPTY,
  ORG_PRIMARY_ACTIONS,
  ORG_SITES_EMPTY,
  organizationSearch,
  organizationStateFromSearch,
  rootLocationQuery
} from "../organization-workspace";

test("organization workspace keeps empty copy, departments route, and primary actions", () => {
  assert.equal(ORG_SITES_EMPTY, "No sites configured yet.");
  assert.equal(ORG_LOCATIONS_EMPTY, "No functional locations for this site.");
  assert.equal(DEPARTMENTS_HREF, "/master-data/departments");
  assert.equal(ORG_PRIMARY_ACTIONS.includes("Departments" as never), true);
  assert.equal(ORG_PRIMARY_ACTIONS.some((action) => /migration/i.test(action)), false);
});

test("organization URL keeps the selected site and location", () => {
  const state = organizationStateFromSearch(new URLSearchParams("site=site-1&location=loc-2"));
  assert.equal(state.siteId, "site-1");
  assert.equal(state.locationId, "loc-2");
  assert.equal(organizationSearch("site-1", "loc-2"), "site=site-1&location=loc-2");
  assert.equal(organizationSearch("site-1", null), "site=site-1");
});

test("root locations are requested without a parent", () => {
  assert.deepEqual(rootLocationQuery("site-1"), { siteId: "site-1", parentId: "null" });
});
