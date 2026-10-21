import { PrismaClient } from "@prisma/client";

import { applyV103Grants } from "../../apps/api/src/database/v103-grants";

function databaseName(url: string): string {
  const named = url.match(/(?:^|;)database=([^;]+)/i);
  if (named?.[1]) return decodeURIComponent(named[1]);
  const path = url.split("?")[0] ?? "";
  return decodeURIComponent(path.slice(path.lastIndexOf("/") + 1));
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.DATABASE_URL?.trim() ?? "";
  const name = url ? databaseName(url) : "";
  if (!/^maintainpro_e2e_/i.test(name)) {
    console.error("Refusing: DATABASE_URL must target a maintainpro_e2e_* database.");
    process.exit(1);
  }
  const prisma = new PrismaClient();
  try {
    const lines = await applyV103Grants(prisma, { dryRun });
    console.log(dryRun ? "DRY-RUN" : "APPLIED");
    console.log(`database=${name}`);
    for (const line of lines) console.log(line);
    if (lines.length === 0) console.log("No changes.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Grant script failed";
  console.error(message);
  process.exit(1);
});
