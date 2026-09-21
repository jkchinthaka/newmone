import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  canSilentlyRefreshSession,
  isAuthCredentialPath,
  resetSilentRefreshLatchForTests,
  runExclusiveSilentRefresh
} from "../bff-silent-refresh";

afterEach(() => {
  resetSilentRefreshLatchForTests();
});

describe("canSilentlyRefreshSession", () => {
  it("allows GET with a refresh cookie on ordinary API reads", () => {
    assert.equal(
      canSilentlyRefreshSession("GET", ["work-orders"], { refreshToken: "rt-valid" }),
      true
    );
  });

  it("never refreshes credential / token endpoints", () => {
    for (const path of [
      ["auth", "login"],
      ["auth", "refresh"],
      ["auth", "logout"],
      ["auth", "register"]
    ]) {
      assert.equal(isAuthCredentialPath(path), true);
      assert.equal(
        canSilentlyRefreshSession("GET", path, { refreshToken: "rt-valid" }),
        false
      );
    }
  });

  it("never refreshes mutations (CSRF / side-effect safety)", () => {
    assert.equal(
      canSilentlyRefreshSession("POST", ["work-orders"], { refreshToken: "rt-valid" }),
      false
    );
    assert.equal(
      canSilentlyRefreshSession("PATCH", ["vehicles", "1"], { refreshToken: "rt-valid" }),
      false
    );
  });

  it("does not refresh when refresh cookie is missing/blank (plain 401)", () => {
    assert.equal(canSilentlyRefreshSession("GET", ["vehicles"], { refreshToken: null }), false);
    assert.equal(canSilentlyRefreshSession("GET", ["vehicles"], { refreshToken: "  " }), false);
    assert.equal(canSilentlyRefreshSession("GET", ["vehicles"], {}), false);
  });
});

describe("runExclusiveSilentRefresh", () => {
  it("coalesces concurrent callers onto one refresh (no refresh storm)", async () => {
    let runs = 0;
    const runner = async () => {
      runs += 1;
      await new Promise((r) => setTimeout(r, 20));
      return { accessToken: "a", refreshToken: "r" };
    };

    const [a, b, c] = await Promise.all([
      runExclusiveSilentRefresh(runner),
      runExclusiveSilentRefresh(runner),
      runExclusiveSilentRefresh(runner)
    ]);

    assert.equal(runs, 1);
    assert.deepEqual(a, b);
    assert.deepEqual(b, c);
  });

  it("allows a later refresh after the in-flight one settles", async () => {
    let runs = 0;
    const runner = async () => {
      runs += 1;
      return runs;
    };

    assert.equal(await runExclusiveSilentRefresh(runner), 1);
    assert.equal(await runExclusiveSilentRefresh(runner), 2);
    assert.equal(runs, 2);
  });
});
