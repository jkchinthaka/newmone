export type GrantDecision =
  | { ok: true; dryRun: boolean; database: string }
  | { ok: false; reason: string };

export function databaseNameFromUrl(url: string): string {
  const named = url.match(/(?:^|;)database=([^;]+)/i);
  if (named?.[1]) return decodeURIComponent(named[1]).trim();
  const path = url.split("?")[0] ?? "";
  const slash = path.lastIndexOf("/");
  return decodeURIComponent(slash >= 0 ? path.slice(slash + 1) : path).trim();
}

/** Dry-run is the default. --apply writes only when the database name matches exactly. nelna is never opened. */
export function resolveGrantInvocation(argv: readonly string[], databaseUrl: string): GrantDecision {
  const database = databaseNameFromUrl(databaseUrl);
  if (!database) {
    return { ok: false, reason: "Refusing: DATABASE_URL must name a database." };
  }
  if (database.toLowerCase() === "nelna") {
    return { ok: false, reason: "Refusing: database nelna is never modified." };
  }
  const apply = argv.includes("--apply");
  const dryRunFlag = argv.includes("--dry-run");
  if (apply && dryRunFlag) {
    return { ok: false, reason: "Refusing: pass either --dry-run or --apply, not both." };
  }
  if (!apply) {
    return { ok: true, dryRun: true, database };
  }
  const confirmArg = argv.find((arg) => arg.startsWith("--confirm-database="));
  const confirm = confirmArg ? confirmArg.slice("--confirm-database=".length) : "";
  if (confirm !== database) {
    return {
      ok: false,
      reason: "Refusing: --apply requires --confirm-database=<exact database name>."
    };
  }
  return { ok: true, dryRun: false, database };
}
