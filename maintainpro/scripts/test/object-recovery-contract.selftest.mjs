#!/usr/bin/env node
import { detectRecoveryHazards } from "../recovery/lib/recovery-safety.mjs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let failed = 0;
function check(id, ok, d) { if (ok) console.log("PASS "+id+": "+d); else { failed++; console.error("FAIL "+id+": "+d); } }
for (const f of ["create-object-backup.mjs","restore-object-backup.mjs","verify-object-backup.mjs"]) {
  const raw = readFileSync(path.join(root,"scripts/recovery",f),"utf8");
  const hits = detectRecoveryHazards(raw).filter(h => ["mc-rm","mc-rb","mc-mirror-remove"].includes(h.id));
  check("DR-OBJECT-007-"+f, hits.length===0, "no bucket deletion in "+f);
}
check("DR-OBJECT-PATH", !readFileSync(path.join(root,"scripts/recovery/restore-object-backup.mjs"),"utf8").includes("..\\"), "path traversal guard present");
if (failed) process.exit(1);
console.log("object-recovery-contract passed");
