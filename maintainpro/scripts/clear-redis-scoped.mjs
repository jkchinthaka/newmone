#!/usr/bin/env node
/**
 * Scoped MaintainPro Redis / Bull queue cleanup.
 * Never runs FLUSHALL. Deletes only known prefixes unless REDIS_DEDICATED_DISPOSABLE=true
 * on local/test (still prefix-scoped — never FLUSHALL).
 *
 * Required:
 *   ALLOW_REDIS_CACHE_CLEAR=true
 *   CONFIRM_REDIS_CACHE_CLEAR=CLEAR_MAINTAINPRO_CACHE
 *   REDIS_URL
 */
import {
  classifyEnvironment,
  loadMaintainProEnv,
  resolveDatabaseTarget
} from "./lib/database-identity.mjs";

const PREFIXES = [
  "bull:",
  "maintainpro:",
  "MaintainPro:",
  "mp:",
  "tenant:",
  "permissions:",
  "reports:",
  "idempotency:",
  "session:"
];

async function main() {
  loadMaintainProEnv();
  if ((process.env.ALLOW_REDIS_CACHE_CLEAR || "").trim() !== "true") {
    throw new Error("Refusing: ALLOW_REDIS_CACHE_CLEAR must be true");
  }
  if ((process.env.CONFIRM_REDIS_CACHE_CLEAR || "").trim() !== "CLEAR_MAINTAINPRO_CACHE") {
    throw new Error("Refusing: CONFIRM_REDIS_CACHE_CLEAR must be CLEAR_MAINTAINPRO_CACHE");
  }

  const redisUrl = (process.env.REDIS_URL || process.env.REDIS_CONNECTION_STRING || "").trim();
  if (!redisUrl) throw new Error("REDIS_URL missing");

  const target = resolveDatabaseTarget();
  const nodeEnv = process.env.NODE_ENV || "";
  const appEnvironment = process.env.APP_ENVIRONMENT || "";
  const classification =
    target.classification !== "unknown" && target.classification !== "unknown-remote"
      ? target.classification
      : classifyEnvironment({
          nodeEnv,
          appEnvironment,
          host: "redis",
          databaseName: ""
        });

  if (classification === "production" || nodeEnv === "production" || appEnvironment === "production") {
    throw new Error("Refusing Redis clear against production");
  }

  const { default: Redis } = await import("ioredis");
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    lazyConnect: true
  });

  let removed = 0;
  const samples = [];
  try {
    await redis.connect();
    for (const prefix of PREFIXES) {
      let cursor = "0";
      do {
        const [next, keys] = await redis.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 200);
        cursor = next;
        if (keys.length) {
          removed += await redis.del(...keys);
          for (const k of keys.slice(0, 3)) {
            if (samples.length < 30) samples.push(k);
          }
        }
      } while (cursor !== "0");
    }
    console.log(`Redis keys removed: ${removed}`);
    console.log("Sample keys:", samples);
  } finally {
    try {
      await redis.quit();
    } catch {
      /* ignore */
    }
  }
}

main().catch((err) => {
  console.error(`REDIS CLEAR FAILED: ${err.message}`);
  process.exit(1);
});