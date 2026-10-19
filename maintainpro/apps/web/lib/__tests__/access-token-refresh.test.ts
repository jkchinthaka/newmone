import assert from "node:assert/strict";
import test from "node:test";

import { resetAccessTokenRefreshForTests, shareAccessTokenRefresh } from "../access-token-refresh";

test("QA-FRESH-MAINT-016 concurrent refreshes share one call and do not force a second logout", async () => {
  resetAccessTokenRefreshForTests();
  let calls = 0;
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const run = () =>
    shareAccessTokenRefresh(async () => {
      calls += 1;
      await gate;
      return true;
    });
  const first = run();
  const second = run();
  release?.();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.equal(a, true);
  assert.equal(b, true);
  resetAccessTokenRefreshForTests();
});
