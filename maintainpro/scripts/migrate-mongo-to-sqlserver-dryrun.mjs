/** Dry-run friendly entry (no DB required for inventory message). */
const args = process.argv.slice(2);
const apply = args.includes("--apply");
console.log(`[migrate] mode=${apply ? "APPLY" : "DRY-RUN"}`);
if (apply) {
  console.error("[migrate] APPLY requires ts compilation path + SQL Server; use: npx --package=tsx tsx scripts/migrate-mongo-to-sqlserver.ts --apply");
  process.exit(1);
}
console.log("[migrate] DRY-RUN OK - no writes. Provide MONGO_URL + SQLSERVER_URL for live inventory.");
console.log("[migrate] See docs/SQLSERVER_MIGRATION_RUNBOOK.md");
