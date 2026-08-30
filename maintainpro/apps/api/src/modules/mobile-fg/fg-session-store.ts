import { Logger } from "@nestjs/common";
import Redis from "ioredis";

import type { FgBrokerSession } from "./fg-session.types";

export const FG_SESSION_STORE = "FG_SESSION_STORE";
export const FG_SESSION_KEY_PREFIX = "mp:fg:broker:";
export const FG_MOBILE_SESSION_TTL_DEFAULT = 1800;

export interface FgSessionStore {
  get(key: string): Promise<FgBrokerSession | null>;
  set(key: string, session: FgBrokerSession, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export class MemoryFgSessionStore implements FgSessionStore {
  private readonly map = new Map<string, { session: FgBrokerSession; expiresAtMs: number }>();

  constructor(private readonly defaultTtlSeconds = FG_MOBILE_SESSION_TTL_DEFAULT) {}

  async get(key: string): Promise<FgBrokerSession | null> {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (entry.expiresAtMs <= Date.now()) {
      this.map.delete(key);
      return null;
    }
    return entry.session;
  }

  async set(key: string, session: FgBrokerSession, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.defaultTtlSeconds;
    this.map.set(key, {
      session,
      expiresAtMs: Date.now() + Math.max(1, ttl) * 1000
    });
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
}

/**
 * Redis-backed FG broker session store.
 * Lazy-connects via ioredis. If Redis is unreachable in non-production,
 * operations fall back to an in-memory store with a warning log.
 * In production, Redis failures propagate (fail closed).
 */
export class RedisFgSessionStore implements FgSessionStore {
  private readonly logger = new Logger(RedisFgSessionStore.name);
  private readonly redis: Redis;
  private readonly fallback: MemoryFgSessionStore;
  private fallbackActive = false;
  private connectAttempted = false;

  constructor(
    redisUrl: string,
    private readonly defaultTtlSeconds = FG_MOBILE_SESSION_TTL_DEFAULT,
    private readonly isProduction = false
  ) {
    this.fallback = new MemoryFgSessionStore(defaultTtlSeconds);
    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      retryStrategy: () => null
    });
    this.redis.on("error", (err: Error) => {
      // Never log connection strings or session payloads.
      this.logger.warn(`FG session Redis error: ${err?.message ?? "unknown"}`);
    });
  }

  private prefixed(key: string): string {
    return `${FG_SESSION_KEY_PREFIX}${key}`;
  }

  private async ensureConnected(): Promise<boolean> {
    if (this.fallbackActive) return false;
    if (this.redis.status === "ready") return true;
    if (this.connectAttempted && this.redis.status !== "wait" && this.redis.status !== "connecting") {
      return this.activateFallbackOrThrow("Redis not ready");
    }
    this.connectAttempted = true;
    try {
      if (this.redis.status === "wait") {
        await this.redis.connect();
      }
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "connect failed";
      return this.activateFallbackOrThrow(msg);
    }
  }

  private activateFallbackOrThrow(reason: string): boolean {
    if (this.isProduction) {
      throw new Error(`FG session Redis unavailable in production: ${reason}`);
    }
    if (!this.fallbackActive) {
      this.logger.warn(
        `FG session Redis unavailable (${reason}); falling back to in-memory store (non-production only)`
      );
      this.fallbackActive = true;
    }
    return false;
  }

  private useRedis(): boolean {
    return !this.fallbackActive;
  }

  async get(key: string): Promise<FgBrokerSession | null> {
    const ok = await this.ensureConnected();
    if (!ok || !this.useRedis()) {
      return this.fallback.get(key);
    }
    try {
      const raw = await this.redis.get(this.prefixed(key));
      if (!raw) return null;
      return JSON.parse(raw) as FgBrokerSession;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "get failed";
      this.activateFallbackOrThrow(msg);
      return this.fallback.get(key);
    }
  }

  async set(key: string, session: FgBrokerSession, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.defaultTtlSeconds;
    const ok = await this.ensureConnected();
    if (!ok || !this.useRedis()) {
      await this.fallback.set(key, session, ttl);
      return;
    }
    try {
      await this.redis.set(this.prefixed(key), JSON.stringify(session), "EX", Math.max(1, ttl));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "set failed";
      this.activateFallbackOrThrow(msg);
      await this.fallback.set(key, session, ttl);
    }
  }

  async delete(key: string): Promise<void> {
    const ok = await this.ensureConnected();
    if (!ok || !this.useRedis()) {
      await this.fallback.delete(key);
      return;
    }
    try {
      await this.redis.del(this.prefixed(key));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "delete failed";
      this.activateFallbackOrThrow(msg);
      await this.fallback.delete(key);
    }
  }
}

export function createFgSessionStore(options: {
  redisUrl?: string;
  ttlSeconds?: number;
  isProduction?: boolean;
}): FgSessionStore {
  const ttl = options.ttlSeconds ?? FG_MOBILE_SESSION_TTL_DEFAULT;
  const redisUrl = (options.redisUrl ?? "").trim();
  if (!redisUrl) {
    return new MemoryFgSessionStore(ttl);
  }
  return new RedisFgSessionStore(redisUrl, ttl, options.isProduction === true);
}
