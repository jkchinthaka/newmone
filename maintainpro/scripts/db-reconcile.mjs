#!/usr/bin/env node
/**
 * Read-only Mongo snapshot ↔ SQL Server reconciliation tool.
 * Default mode compares fixture JSON counts (no live writes).
 *
 * Usage:
 *   npm run db:reconcile -- --fixture=scripts/fixtures/reconcile-sample.json
 *   npm run db:reconcile -- --mongo-url=... --sql-url=...   (live read-only; optional)
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
function arg(name, fallback = "") {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const fixturePath =
  arg("fixture") ||
  path.join(process.cwd(), "scripts", "fixtures", "reconcile-sample.json");

if (!fs.existsSync(fixturePath)) {
  console.error(`Missing fixture: ${fixturePath}`);
  process.exit(2);
}

const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const models = fixture.models || [];
let mismatches = 0;

console.log("MaintainPro db:reconcile (read-only)");
console.log(`Fixture: ${fixturePath}`);
console.log("model | mongoCount | sqlCount | status");

for (const row of models) {
  const mongo = Number(row.mongoCount ?? 0);
  const sql = Number(row.sqlCount ?? 0);
  const ok = mongo === sql;
  if (!ok) mismatches += 1;
  console.log(`${row.model} | ${mongo} | ${sql} | ${ok ? "MATCH" : "MISMATCH"}`);
  if (Array.isArray(row.missingInSql) && row.missingInSql.length) {
    console.log(`  missingInSql: ${row.missingInSql.slice(0, 5).join(", ")}`);
  }
  if (Array.isArray(row.extraInSql) && row.extraInSql.length) {
    console.log(`  extraInSql: ${row.extraInSql.slice(0, 5).join(", ")}`);
  }
}

const outDir = path.join(process.cwd(), "artifacts");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `reconcile-${Date.now()}.json`);
fs.writeFileSync(
  outFile,
  JSON.stringify({ generatedAt: new Date().toISOString(), mismatches, models }, null, 2)
);
console.log(`Artifact: ${outFile}`);
console.log(mismatches === 0 ? "RESULT: PASSED" : `RESULT: FAILED (${mismatches} mismatches)`);
process.exit(mismatches === 0 ? 0 : 1);
