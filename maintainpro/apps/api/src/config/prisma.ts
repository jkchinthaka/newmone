import { PrismaClient } from "@prisma/client";

import { env } from "./env";
import { logger } from "./logger";

declare global {
  var maintainProPrisma: PrismaClient | undefined;
}

const createPrismaClient = (): PrismaClient =>
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["warn", "error"]
  });

export const prisma = globalThis.maintainProPrisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalThis.maintainProPrisma = prisma;
}

void prisma
  .$connect()
  .then(() => logger.info("Prisma client connected"))
  .catch((error: unknown) => logger.warn(`Prisma connection skipped: ${String(error)}`));
