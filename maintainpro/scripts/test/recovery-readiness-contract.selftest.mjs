#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const svc = readFileSync(path.join(root,"apps/api/src/deployment-readiness.service.ts"),"utf8");
let failed=0;
function check(id,ok,d){ if(ok) console.log("PASS "+id); else {failed++; console.error("FAIL "+id+": "+d);} }
check("READY-001", /backupPolicyConfigured|backupRestore|lastRestoreTest/.test(svc), "recovery readiness keys");
check("READY-002", /backupReplication/.test(svc), "replication check remains separate");
check("READY-003", /RECOVERY_|BACKUP_RESTORE_REQUIRED/.test(svc), "env-gated recovery evidence");
if(failed) process.exit(1);
console.log("recovery-readiness-contract passed");
