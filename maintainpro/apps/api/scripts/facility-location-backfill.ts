import "dotenv/config";

import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";

import { FacilityLocationBackfillService } from "../src/modules/facilities/facility-location-backfill.service";

function parseArgs(argv: string[]) {
  const tenantArg = argv.find((arg) => arg.startsWith("--tenant="));
  return {
    apply: argv.includes("--apply"),
    tenantId: tenantArg?.split("=")[1]?.trim() || undefined
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const configService = new ConfigService(process.env);
  const prisma = new PrismaClient();

  try {
    const service = new FacilityLocationBackfillService(prisma as never, configService);
    const summary = await service.run({
      tenantId: args.tenantId,
      apply: args.apply
    });

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
