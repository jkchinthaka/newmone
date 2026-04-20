import { Router } from "express";

import { asyncHandler } from "../../common/utils/async-handler";
import { prisma } from "../../config/prisma";
import { redis } from "../../config/redis";

const healthRouter = Router();

healthRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    let redisStatus: "up" | "down" = "down";
    let databaseStatus: "up" | "down" = "down";

    try {
      const redisPing = await redis.ping();
      redisStatus = redisPing === "PONG" ? "up" : "down";
    } catch {
      redisStatus = "down";
    }

    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseStatus = "up";
    } catch {
      databaseStatus = "down";
    }

    const isHealthy = redisStatus === "up" && databaseStatus === "up";

    return res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      services: {
        redis: redisStatus,
        database: databaseStatus
      }
    });
  })
);

export { healthRouter };
