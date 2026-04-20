import Redis from "ioredis";

import { env } from "./env";
import { logger } from "./logger";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true
});

redis.on("connect", () => {
  logger.info("Redis connected");
});

redis.on("error", (error: unknown) => {
  logger.error(`Redis error: ${String(error)}`);
});
