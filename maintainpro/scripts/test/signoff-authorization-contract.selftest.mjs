#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let failed = 0;
const check = (id, ok, d) => {
  if (ok) console.log(`PASS ${id}`);
  else {
    failed += 1;
    console.error(`FAIL ${id}: ${d}`);
  }
};

const svc = path.join(root, "apps/api/src/modules/go-live/go-live-signoff.service.ts");
const constants = path.join(root, "apps/api/src/modules/go-live/go-live.constants.ts");
check("SIGNOFF-001", existsSync(svc) && existsSync(constants), "files missing");
const s = readFileSync(svc, "utf8") + readFileSync(constants, "utf8");
check("SIGNOFF-002", /assertSignOffRoleAuthorized/.test(s), "authorization assert missing");
check("SIGNOFF-003", /SIGN_OFF_ROLE_AUTHORIZATION/.test(s), "matrix missing");
check("SIGNOFF-004", /MAX_SIGN_OFF_CATEGORIES_PER_USER/.test(s), "per-user bound missing");
check("SIGNOFF-005", /Invalid sign-off category/.test(s), "spoof rejection missing");
if (failed) process.exit(1);
console.log("signoff-authorization-contract ok");
