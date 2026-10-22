import assert from "node:assert/strict";
import test from "node:test";

import { showPermissionOverridesCard } from "../permission-overrides";

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
