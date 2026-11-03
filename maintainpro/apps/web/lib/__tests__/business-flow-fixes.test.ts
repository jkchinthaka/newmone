import test from "node:test";
import assert from "node:assert/strict";

import { formatDistance } from "../fraud-control-api";
import { requestListStatusLabel } from "../maintenance-request-ui";
import { siteGeoDraftFrom, siteGeoPayload } from "../site-geo";
import { permitActions } from "../work-permit-actions";

const admin = { id: "admin-1", role: "ADMIN" };
const manager = { id: "mgr-1", role: "MANAGER" };

test("permit approve is admin-only; an admin may approve their own permit", () => {
  const byManager = permitActions({ status: "DRAFT", issuedById: "sup-1" }, manager);
  assert.equal(byManager.find((a) => a.status === "APPROVED")?.disabledReason, "Admin only");
  const byOtherAdmin = permitActions({ status: "DRAFT", issuedById: "sup-1" }, admin);
  assert.equal(byOtherAdmin.find((a) => a.status === "APPROVED")?.disabledReason, undefined);
  const ownPermit = permitActions({ status: "DRAFT", issuedById: "admin-1" }, admin);
  assert.equal(ownPermit.find((a) => a.status === "APPROVED")?.disabledReason, undefined);
  assert.deepEqual(
    permitActions({ status: "ACTIVE" }, manager).map((a) => a.status),
    ["SUSPENDED", "CLOSED"]
  );
  assert.equal(permitActions({ status: "SUSPENDED" }, manager).find((a) => a.status === "ACTIVE")?.disabledReason, "Admin only");
  assert.deepEqual(permitActions({ status: "CLOSED" }, admin), []);
});

test("converted request label follows the job", () => {
  assert.equal(requestListStatusLabel("CONVERTED_TO_WO", "CLOSED"), "Done");
  assert.equal(requestListStatusLabel("CONVERTED_TO_WO", "IN_PROGRESS"), "Job in progress");
  assert.equal(requestListStatusLabel("CONVERTED_TO_WO", "TECHNICIAN_COMPLETED"), "Job waiting for check");
  assert.equal(requestListStatusLabel("CONVERTED_TO_WO", null), "Job created");
  assert.equal(requestListStatusLabel("NEW", "CLOSED"), "New");
});

test("site location needs both coordinates and a sane radius", () => {
  assert.deepEqual(siteGeoPayload({ latitude: "", longitude: "", geoRadiusMeters: "" }), {
    ok: true,
    value: { latitude: null, longitude: null, geoRadiusMeters: null }
  });
  assert.deepEqual(siteGeoPayload({ latitude: "6.84", longitude: "80.0", geoRadiusMeters: "300" }), {
    ok: true,
    value: { latitude: 6.84, longitude: 80, geoRadiusMeters: 300 }
  });
  assert.equal(siteGeoPayload({ latitude: "6.84", longitude: "", geoRadiusMeters: "" }).ok, false);
  assert.equal(siteGeoPayload({ latitude: "95", longitude: "80", geoRadiusMeters: "" }).ok, false);
  assert.equal(siteGeoPayload({ latitude: "6", longitude: "80", geoRadiusMeters: "10" }).ok, false);
  assert.deepEqual(siteGeoDraftFrom({ latitude: 6.5, longitude: null, geoRadiusMeters: 400 }), {
    latitude: "6.5",
    longitude: "",
    geoRadiusMeters: "400"
  });
});

test("distance text", () => {
  assert.equal(formatDistance(640), "640 m");
  assert.equal(formatDistance(1234), "1.2 km");
});
