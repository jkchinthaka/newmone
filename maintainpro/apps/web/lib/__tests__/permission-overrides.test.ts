import assert from "node:assert/strict";
import test from "node:test";

import {
  permissionOverrideDeleteConfig,
  removalReasonIsNew,
  showPermissionOverridesCard
} from "../permission-overrides";

test("permission overrides card is visible only for another user when the studio flag is on", () => {
  const base = {
    role: "SUPER_ADMIN" as string | null,
    accessStudioEnabled: true,
    editingUserId: "user-2" as string | null,
    currentUserId: "user-1" as string | null
  };

  assert.equal(showPermissionOverridesCard(base), true);
  assert.equal(showPermissionOverridesCard({ ...base, accessStudioEnabled: false }), false);
  assert.equal(showPermissionOverridesCard({ ...base, role: "ADMIN" }), false);
  assert.equal(showPermissionOverridesCard({ ...base, editingUserId: null }), false);
  assert.equal(showPermissionOverridesCard({ ...base, editingUserId: "user-1", currentUserId: "user-1" }), false);
});

test("removing an override sends permissionKey and reason in the JSON body", () => {
  const config = permissionOverrideDeleteConfig("assets.view", "shift ended");

  assert.deepEqual(config, {
    data: { permissionKey: "assets.view", reason: "shift ended" }
  });
  assert.equal(Object.hasOwn(config, "params"), false);
});

test("a removal reason must be new", () => {
  assert.equal(removalReasonIsNew("cover the night shift", "cover the night shift"), false);
  assert.equal(removalReasonIsNew("cover the night shift", "  "), false);
  assert.equal(removalReasonIsNew("cover the night shift", "shift ended"), true);
});
