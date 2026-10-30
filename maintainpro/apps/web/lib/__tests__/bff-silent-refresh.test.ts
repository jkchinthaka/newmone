import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  canSilentlyRefreshSession,
  isAuthCredentialPath,
  resetSilentRefreshLatchForTests,
  runExclusiveSilentRefresh,
  silentRefreshLatchCountForTests
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
      runExclusiveSilentRefresh("rt-user-a", runner),
      runExclusiveSilentRefresh("rt-user-a", runner),
      runExclusiveSilentRefresh("rt-user-a", runner)
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

    assert.equal(await runExclusiveSilentRefresh("rt-user-a", runner), 1);
    assert.equal(await runExclusiveSilentRefresh("rt-user-a", runner), 2);
    assert.equal(runs, 2);
    assert.equal(silentRefreshLatchCountForTests(), 0);
  });

  it("never shares a refresh result between two different refresh tokens", async () => {
    const calls: string[] = [];
    const runnerFor = (token: string) => async () => {
      calls.push(token);
      await new Promise((r) => setTimeout(r, 20));
      return { accessToken: `access-for-${token}`, refreshToken: `next-${token}` };
    };

    const [a, b, a2] = await Promise.all([
      runExclusiveSilentRefresh("rt-user-a", runnerFor("rt-user-a")),
      runExclusiveSilentRefresh("rt-user-b", runnerFor("rt-user-b")),
      runExclusiveSilentRefresh("rt-user-a", runnerFor("rt-user-a"))
    ]);

    assert.deepEqual(calls.sort(), ["rt-user-a", "rt-user-b"]);
    assert.equal(a.accessToken, "access-for-rt-user-a");
    assert.equal(a2.accessToken, "access-for-rt-user-a");
    assert.equal(b.accessToken, "access-for-rt-user-b");
    assert.equal(silentRefreshLatchCountForTests(), 0);
  });

  it("clears the latch when the refresh rejects", async () => {
    await assert.rejects(
      runExclusiveSilentRefresh("rt-user-a", async () => {
        throw new Error("boom");
      })
    );
    assert.equal(silentRefreshLatchCountForTests(), 0);
  });
});
