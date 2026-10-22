import { PrismaClient } from "@prisma/client";

import { assertGrantDatabase, grantAccessStudioKeys } from "../../apps/api/src/database/grant-access-studio-keys";

async function main() {
  const apply = process.argv.includes("--apply");
  const url = process.env.DATABASE_URL?.trim() ?? "";
  const name = assertGrantDatabase(url, apply);
  const prisma = new PrismaClient();
  try {
    const result = await grantAccessStudioKeys(prisma, { dryRun: !apply });
    console.log(apply ? "APPLY" : "DRY-RUN");
    console.log(`database=${name}`);
    for (const line of result.lines) console.log(line);
    if (!result.applied && result.lines.some((line) => line.startsWith("MISMATCH"))) process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Grant script failed");
  process.exit(1);
});
