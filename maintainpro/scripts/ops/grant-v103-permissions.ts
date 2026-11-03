import { PrismaClient } from "@prisma/client";

import { applyV103Grants } from "../../apps/api/src/database/v103-grants";
import { resolveGrantInvocation } from "./grant-v103-guard";

async function main() {
  const decision = resolveGrantInvocation(process.argv.slice(2), process.env.DATABASE_URL?.trim() ?? "");
  if (!decision.ok) {
    console.error(decision.reason);
    process.exit(1);
  }
  const prisma = new PrismaClient();
  try {
    const lines = await applyV103Grants(prisma, { dryRun: decision.dryRun });
    console.log(decision.dryRun ? "DRY-RUN" : "APPLIED");
    console.log(`database=${decision.database}`);
    console.log(decision.dryRun ? "Planned changes:" : "Applied changes:");
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
