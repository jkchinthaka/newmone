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

const doc = path.join(root, "docs/remediation/CREDENTIAL_ROTATION_PLAN.md");
check("CRED-001", existsSync(doc), "rotation plan missing");
const t = readFileSync(doc, "utf8");
check("CRED-002", /OPERATOR_OWNED_P0/.test(t), "mongo root P0 missing");
check("CRED-003", /Never auto-rotate Mongo root/i.test(t), "auto-rotate ban missing");
if (failed) process.exit(1);
console.log("credential-rotation-contract ok");
