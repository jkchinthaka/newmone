import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

import { PrismaService } from "./database/prisma.service";
import { ReplicationSyncService } from "./database/replication-sync.service";
import { sanitizeReplicationError } from "./database/replication.config";

export type CheckStatus = "operational" | "degraded" | "unconfigured";
export type OverallStatus = "operational" | "degraded";

export interface DependencyCheck {
  key: string;
  label: string;
  status: CheckStatus;
  required: boolean;
  latencyMs?: number;
  message: string;
  action?: string;
  details?: Record<string, unknown>;
}

export interface ConfigCheck {
  key: string;
  label: string;
  status: CheckStatus;
  required: boolean;
  message: string;
  action?: string;
}

@Injectable()
export class HealthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ReplicationSyncService) private readonly replicationSync: ReplicationSyncService,
    @Inject(ConfigService) private readonly configService: ConfigService
  ) {}

  getLiveness() {
    return {
      status: "ok",
      service: "maintainpro-api",
      environment: this.configService.get<string>("NODE_ENV", "development"),
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    };
  }

  async getPublicHealth() {
    const database = await this.checkDatabase();

    return {
      status: database.status === "operational" ? "ok" : "degraded",
      service: "maintainpro-api",
      environment: this.configService.get<string>("NODE_ENV", "development"),
      timestamp: new Date().toISOString(),
      database: {
        status: database.status,
        latencyMs: database.latencyMs,
        message: database.message
      }
    };
  }

  async getReadiness() {
    const [database, backupReplication, redis, objectStorage] = await Promise.all([
      this.checkDatabase(),
      this.checkBackupReplication(),
      this.checkRedis(),
      this.checkObjectStorage()
    ]);

    const dependencies = [database, backupReplication, redis, objectStorage];
    const configuration = this.getConfigurationChecks();
    const allChecks = [...dependencies, ...configuration];
    const requiredDown = allChecks.some(
      (check) => check.required && check.status !== "operational"
    );
    const status: OverallStatus = requiredDown ? "degraded" : "operational";

    return {
      status,
      service: "maintainpro-api",
      environment: this.configService.get<string>("NODE_ENV", "development"),
      timestamp: new Date().toISOString(),
      summary: {
        operational: allChecks.filter((check) => check.status === "operational").length,
        degraded: allChecks.filter((check) => check.status === "degraded").length,
        unconfigured: allChecks.filter((check) => check.status === "unconfigured").length,
        required: allChecks.filter((check) => check.required).length
      },
      dependencies,
      configuration
    };
  }

  private async checkDatabase(): Promise<DependencyCheck> {
    const startedAt = performance.now();
    const config = this.prisma.getReplicationConfig();

    try {
      await this.withTimeout(
        this.prisma.checkPrimary(),
        2_500,
        "Primary database check timed out"
      );

      return {
        key: "primaryDatabase",
        label: "Primary MongoDB / Prisma",
        status: "operational",
        required: true,
        latencyMs: this.elapsedMs(startedAt),
        message: "Primary database connection and core collections are reachable.",
        details: {
          databaseName: config.primaryDatabaseName || "unknown",
          sourceOfTruth: true
        }
      };
    } catch (error) {
      return {
        key: "primaryDatabase",
        label: "Primary MongoDB / Prisma",
        status: "degraded",
        required: true,
        latencyMs: this.elapsedMs(startedAt),
        message: this.safeErrorMessage(error),
        action: "Check PRIMARY_DATABASE_URL/DATABASE_URL, Atlas connectivity, MongoDB replica set health, and run npm run db:seed after restoring the database.",
        details: {
          databaseName: config.primaryDatabaseName || "unknown",
          sourceOfTruth: true
        }
      };
    }
  }

  private async checkBackupReplication(): Promise<DependencyCheck> {
    const startedAt = performance.now();
    const config = this.prisma.getReplicationConfig();

    try {
      const snapshot = await this.withTimeout(
        this.replicationSync.getStatusSnapshot(),
        3_000,
        "Backup replication check timed out"
      );
      const required = snapshot.strictModeActive
        ? config.backupRequiredForStrictMode
        : config.backupRequiredForReadiness;

      return {
        key: "backupDatabaseReplication",
        label: "Backup MongoDB replication",
        status: snapshot.backupStatus,
        required: snapshot.enabled ? required : false,
        latencyMs: this.elapsedMs(startedAt),
        message: snapshot.message,
        action:
          snapshot.backupStatus === "operational"
            ? undefined
            : "Check BACKUP_DATABASE_URL, local MongoDB authSource, replicaSet=rs0, and pending ReplicationOutbox failures.",
        details: {
          configured: snapshot.configured,
          enabled: snapshot.enabled,
          mode: snapshot.mode,
          primaryDatabaseName: snapshot.primaryDatabaseName || "unknown",
          backupDatabaseName: snapshot.backupDatabaseName || "unknown",
          strictModeActive: snapshot.strictModeActive,
          pendingEvents: snapshot.pendingEvents,
          processingEvents: snapshot.processingEvents,
          failedEvents: snapshot.failedEvents,
          deadLetterEvents: snapshot.deadLetterEvents,
          lastSuccessfulSync: snapshot.lastSuccessfulSync,
          replicationLagMs: snapshot.replicationLagMs
        }
      };
    } catch (error) {
      return {
        key: "backupDatabaseReplication",
        label: "Backup MongoDB replication",
        status: "degraded",
        required: config.mode === "strict_dual_write" ? config.backupRequiredForStrictMode : config.backupRequiredForReadiness,
        latencyMs: this.elapsedMs(startedAt),
        message: this.safeErrorMessage(error),
        action: "Confirm the ReplicationOutbox schema exists and backup replication configuration is valid.",
        details: {
          configured: Boolean(config.backupDatabaseUrl),
          enabled: config.enabled,
          mode: config.mode,
          primaryDatabaseName: config.primaryDatabaseName || "unknown",
          backupDatabaseName: config.backupDatabaseName || "unknown"
        }
      };
    }
  }

  private async checkRedis(): Promise<DependencyCheck> {
    const redisUrl = this.configService.get<string>("REDIS_URL", "");
    const startedAt = performance.now();

    if (!redisUrl.trim()) {
      return {
        key: "redis",
        label: "Redis queues",
        status: "unconfigured",
        required: true,
        message: "REDIS_URL is not configured.",
        action: "Set REDIS_URL to the Redis service used by Bull queues."
      };
    }

    const client = new Redis(redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      connectTimeout: 1_500,
      commandTimeout: 1_500,
      retryStrategy: () => null
    });
    client.on("error", () => undefined);

    try {
      await this.withTimeout(client.connect(), 2_000, "Redis connection timed out");
      await this.withTimeout(client.ping(), 1_000, "Redis ping timed out");

      return {
        key: "redis",
        label: "Redis queues",
        status: "operational",
        required: true,
        latencyMs: this.elapsedMs(startedAt),
        message: "Redis is accepting queue commands."
      };
    } catch (error) {
      return {
        key: "redis",
        label: "Redis queues",
        status: "degraded",
        required: true,
        latencyMs: this.elapsedMs(startedAt),
        message: this.safeErrorMessage(error),
        action: "Start Redis or update REDIS_URL to the reachable cache endpoint."
      };
    } finally {
      client.disconnect();
    }
  }

  private async checkObjectStorage(): Promise<DependencyCheck> {
    if (this.hasCloudinaryConfig()) {
      return {
        key: "objectStorage",
        label: "Cloudinary file storage",
        status: "operational",
        required: true,
        message: "Cloudinary is configured for persistent uploaded files."
      };
    }

    const endpoint = this.configService.get<string>("MINIO_ENDPOINT", "");
    const port = this.configService.get<number>("MINIO_PORT", 9000);
    const useSsl = this.configService.get<boolean>("MINIO_USE_SSL", false);
    const bucket = this.configService.get<string>("MINIO_BUCKET", "");
    const startedAt = performance.now();

    if (!endpoint.trim() || !bucket.trim()) {
      return {
        key: "objectStorage",
        label: "Object storage",
        status: "unconfigured",
        required: true,
        message: "MinIO/S3 endpoint or bucket is not configured.",
        action: "Set Cloudinary credentials or MINIO_ENDPOINT, MINIO_PORT, and MINIO_BUCKET for uploaded files and reports."
      };
    }

    try {
      const healthUrl = this.buildMinioHealthUrl(endpoint, port, useSsl);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2_000);
      const response = await fetch(healthUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Object storage health returned HTTP ${response.status}`);
      }

      return {
        key: "objectStorage",
        label: "Object storage",
        status: "operational",
        required: true,
        latencyMs: this.elapsedMs(startedAt),
        message: `Object storage endpoint is reachable for bucket ${bucket}.`
      };
    } catch (error) {
      return {
        key: "objectStorage",
        label: "Object storage",
        status: "degraded",
        required: true,
        latencyMs: this.elapsedMs(startedAt),
        message: this.safeErrorMessage(error),
        action: "Start MinIO/S3 or correct MINIO_ENDPOINT and MINIO_PORT."
      };
    }
  }

  private getConfigurationChecks(): ConfigCheck[] {
    return [
      this.providerConfigCheck({
        key: "smtp",
        label: "Email notifications",
        enabledKey: "SMTP_ENABLED",
        env: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"],
        configured: "SMTP notification delivery is enabled and configured.",
        disabled: "SMTP notification delivery is disabled.",
        missing: "SMTP notification delivery is enabled but incomplete.",
        action: "Set SMTP_ENABLED=true with SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM."
      }),
      this.configCheck({
        key: "stripe",
        label: "Billing provider",
        required: false,
        env: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
        configured: "Stripe billing keys are configured.",
        missing: "Stripe billing is not configured.",
        action: "Set Stripe keys before enabling paid subscriptions."
      }),
      this.configCheck({
        key: "oauthGoogle",
        label: "Google OAuth",
        required: false,
        env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_CALLBACK_URL"],
        configured: "Google OAuth credentials are configured.",
        missing: "Google OAuth is not configured.",
        action: "Set Google OAuth credentials or keep the provider disabled."
      }),
      this.providerConfigCheck({
        key: "sms",
        label: "SMS provider",
        enabledKey: "SMS_ENABLED",
        env: ["SMS_API_URL", "SMS_API_KEY", "SMS_SENDER_ID"],
        configured: "Generic HTTP SMS provider is enabled and configured.",
        disabled: "SMS provider is disabled.",
        missing: "SMS provider is enabled but incomplete.",
        action: "Set SMS_ENABLED=true with SMS_API_URL, SMS_API_KEY, and SMS_SENDER_ID."
      }),
      this.erpProviderCheck(),
      this.providerConfigCheck({
        key: "push",
        label: "Push provider",
        enabledKey: "PUSH_PROVIDER_ENABLED",
        env: ["PUSH_PROVIDER_API_URL", "PUSH_PROVIDER_API_KEY"],
        configured: "Generic HTTP push provider is enabled and configured.",
        disabled: "Push provider is using noop fallback.",
        missing: "Push provider is enabled but incomplete.",
        action: "Set PUSH_PROVIDER_ENABLED=true with PUSH_PROVIDER_API_URL and PUSH_PROVIDER_API_KEY when a vendor is selected."
      }),
      this.configCheck({
        key: "aiCopilot",
        label: "AI assistant",
        required: false,
        env: ["RAPIDAPI_COPILOT_API_KEY", "RAPIDAPI_COPILOT_HOST"],
        configured: "AI assistant provider is configured.",
        missing: "AI assistant provider is not configured.",
        action: "Set RAPIDAPI_COPILOT_API_KEY for production AI responses."
      }),
      this.configCheck({
        key: "qrProvider",
        label: "QR generation",
        required: false,
        env: ["RAPIDAPI_QR_CODE_API_KEY", "RAPIDAPI_QR_CODE_HOST"],
        configured: "External QR provider is configured.",
        missing: "Using local QR generation fallback.",
        action: "Set RapidAPI QR keys only if the external QR provider is required."
      })
    ];
  }

  private configCheck(options: {
    key: string;
    label: string;
    required: boolean;
    env: string[];
    configured: string;
    missing: string;
    action: string;
  }): ConfigCheck {
    const missing = options.env.filter((key) => !this.hasConfigValue(key));

    if (missing.length === 0) {
      return {
        key: options.key,
        label: options.label,
        status: "operational",
        required: options.required,
        message: options.configured
      };
    }

    return {
      key: options.key,
      label: options.label,
      status: options.required ? "degraded" : "unconfigured",
      required: options.required,
      message: `${options.missing} Missing: ${missing.join(", ")}.`,
      action: options.action
    };
  }

  private providerConfigCheck(options: {
    key: string;
    label: string;
    enabledKey: string;
    env: string[];
    configured: string;
    disabled: string;
    missing: string;
    action: string;
  }): ConfigCheck {
    const enabled = this.configService.get<boolean>(options.enabledKey, false);
    if (!enabled) {
      return {
        key: options.key,
        label: options.label,
        status: "unconfigured",
        required: false,
        message: options.disabled
      };
    }

    const missing = options.env.filter((key) => !this.hasConfigValue(key));
    if (missing.length === 0) {
      return {
        key: options.key,
        label: options.label,
        status: "operational",
        required: true,
        message: options.configured
      };
    }

    return {
      key: options.key,
      label: options.label,
      status: "degraded",
      required: true,
      message: `${options.missing} Missing: ${missing.join(", ")}.`,
      action: options.action
    };
  }

  private erpProviderCheck(): ConfigCheck {
    const provider = this.configService.get<string>("ERP_SYNC_PROVIDER", "mock").toLowerCase();
    const isProduction = this.configService.get<string>("NODE_ENV", "development") === "production";
    const mockAllowed = this.configService.get<boolean>("ERP_SYNC_ALLOW_MOCK_IN_PRODUCTION", false);

    if (provider === "mock") {
      const allowed = !isProduction || mockAllowed;
      return {
        key: "erp",
        label: "ERP sync provider",
        status: allowed ? "unconfigured" : "degraded",
        required: isProduction,
        message: allowed
          ? "ERP sync is using MOCK_ERP mode."
          : "ERP sync is set to mock mode in production and is blocked unless explicitly allowed.",
        action: allowed ? undefined : "Set ERP_SYNC_PROVIDER=http with ERP_API_URL and ERP_API_KEY, or explicitly de-scope ERP sync."
      };
    }

    const missing = ["ERP_API_URL", "ERP_API_KEY"].filter((key) => !this.hasConfigValue(key));
    if (missing.length === 0) {
      return {
        key: "erp",
        label: "ERP sync provider",
        status: "operational",
        required: true,
        message: "HTTP ERP sync provider is configured."
      };
    }

    return {
      key: "erp",
      label: "ERP sync provider",
      status: "degraded",
      required: true,
      message: `HTTP ERP sync provider is incomplete. Missing: ${missing.join(", ")}.`,
      action: "Set ERP_API_URL and ERP_API_KEY before enabling production ERP sync."
    };
  }

  private hasConfigValue(key: string): boolean {
    const value = this.configService.get<string | number | boolean | undefined>(key);
    return value !== undefined && String(value).trim().length > 0;
  }

  private hasCloudinaryConfig(): boolean {
    return ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"].every((key) =>
      this.hasConfigValue(key)
    );
  }

  private buildMinioHealthUrl(endpoint: string, port: number, useSsl: boolean): string {
    if (/^https?:\/\//i.test(endpoint)) {
      const url = new URL(endpoint);
      if (!url.port && port) {
        url.port = String(port);
      }
      url.pathname = "/minio/health/live";
      return url.toString();
    }

    const protocol = useSsl ? "https" : "http";
    return `${protocol}://${endpoint}:${port}/minio/health/live`;
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    let timeout: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  private elapsedMs(startedAt: number): number {
    return Math.max(1, Math.round(performance.now() - startedAt));
  }

  private safeErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
      return sanitizeReplicationError(error);
    }

    return "Dependency check failed.";
  }
}