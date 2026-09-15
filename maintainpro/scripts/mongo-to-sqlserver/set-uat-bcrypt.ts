import * as bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

/**
 * Disposable MaintainProDev only. Password from MAINTAINPRO_SMOKE_PASSWORD or argv[2].
 * Never use against production.
 */
async function main() {
  const password = process.env.MAINTAINPRO_SMOKE_PASSWORD || process.argv[2];
  if (!password) {
    console.error("Usage: MAINTAINPRO_SMOKE_PASSWORD=... npx tsx scripts/mongo-to-sqlserver/set-uat-bcrypt.ts");
    process.exit(2);
  }
  const p = new PrismaClient();
  try {
    const hash = await bcrypt.hash(password, 12);
    const r = await p.user.updateMany({ data: { passwordHash: hash } });
    console.log(JSON.stringify({ updated: r.count, bcryptPrefix: hash.slice(0, 7) }));
  } finally {
    await p.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
