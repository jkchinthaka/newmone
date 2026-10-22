import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { rememberSignIn } from "../bff-proxy";
import { IT_HELP_DESK_URL, LOGIN_ATTEMPTS_BEFORE_LOCK, LOGIN_LOCKOUT_MINUTES } from "../support-links";

function fakeRequest(header?: string, cookie?: string) {
  return {
    headers: new Headers(header === undefined ? {} : { "x-remember-me": header }),
    cookies: {
      get: (name: string) =>
        name === "maintainpro_remember" && cookie !== undefined ? { name, value: cookie } : undefined
    }
  } as unknown as Parameters<typeof rememberSignIn>[0];
}

test("login follows the Keep me signed in box", () => {
  assert.equal(rememberSignIn(fakeRequest("1"), ["auth", "login"]), true);
  assert.equal(rememberSignIn(fakeRequest("0"), ["auth", "login"]), false);
  assert.equal(rememberSignIn(fakeRequest(), ["auth", "login"]), true);
});

test("later refreshes keep the choice made at sign-in", () => {
  assert.equal(rememberSignIn(fakeRequest(undefined, "0"), ["auth", "refresh"]), false);
  assert.equal(rememberSignIn(fakeRequest(undefined, "1"), ["work-orders"]), true);
  assert.equal(rememberSignIn(fakeRequest(), ["work-orders"]), true);
});

test("login page shows the help desk link, remember box and the 5/10/30 lock rule", () => {
  const page = readFileSync(path.resolve(__dirname, "../../app/(auth)/login/page.tsx"), "utf8");
  assert.equal(IT_HELP_DESK_URL, "https://nelna-helpdesk.southeastasia.cloudapp.azure.com/login");
  assert.equal(LOGIN_ATTEMPTS_BEFORE_LOCK, 5);
  assert.deepEqual([...LOGIN_LOCKOUT_MINUTES], [5, 10, 30]);
  assert.match(page, /Sign in to MaintainPro/);
  assert.match(page, /Keep me signed in on this device/);
  assert.match(page, /"x-remember-me": values\.rememberMe \? "1" : "0"/);
  assert.match(page, /href=\{IT_HELP_DESK_URL\}/);
});
