import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

function redact(message) {
  return String(message ?? "").replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, "mongodb://[REDACTED]");
}

try {
  await prisma.$connect();
  const [tenantCount, userCount, workOrderCount] = await Promise.all([
    prisma.tenant.count(),
    prisma.user.count(),
    prisma.workOrder.count()
  ]);

  console.log(
    JSON.stringify({
      connected: true,
      tenantCount,
      userCount,
      workOrderCount
    })
  );
} catch (error) {
  console.log(
    JSON.stringify({
      connected: false,
      error: redact(error instanceof Error ? error.message : error)
    })
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
