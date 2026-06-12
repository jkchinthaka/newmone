import { Inject, Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { PrismaService } from "./database/prisma.service";
import { ReplicationSyncService } from "./database/replication-sync.service";
import { sanitizeReplicationError } from "./database/replication.config";
import { QueueHealthService } from "./modules/queues/queue-health.service";

export type CheckStatus =
  | "operational"
  | "degraded"
  | "failed"
  | "mock"
  | "misconfigured"
  | "unconfigured"
  | "disabled";
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
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Optional()
    @Inject(QueueHealthService)
    private readonly queueHealthService?: QueueHealthService
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
    const [database, backupReplication, queueChecks, queueHealthDetails, objectStorage] = await Promise.all([
      this.checkDatabase(),
      this.checkBackupReplication(),
      this.checkQueues(),
      this.getQueueHealthDetails(),
      this.checkObjectStorage()
    ]);

    const dependencies = [database, backupReplication, ...queueChecks, objectStorage];
    const configuration = this.getConfigurationChecks();
    const allChecks = [...dependencies, ...configuration];
    const requiredDown = allChecks.some(
      (check) => check.required && check.status !== "operational"
    );
    const status: OverallStatus = requiredDown ? "degraded" : "operational";

    const queueReadiness = this.buildQueueReadinessView(queueHealthDetails);

    return {
      status,
      service: "maintainpro-api",
      environment: this.configService.get<string>("NODE_ENV", "development"),
      timestamp: new Date().toISOString(),
      summary: {
        operational: allChecks.filter((check) => check.status === "operational").length,
        degraded: allChecks.filter((check) => check.status === "degraded").length,
        failed: allChecks.filter((check) => check.status === "failed").length,
        mock: allChecks.filter((check) => check.status === "mock").length,
        misconfigured: allChecks.filter((check) => check.status === "misconfigured").length,
        unconfigured: allChecks.filter((check) => check.status === "unconfigured").length,
        disabled: allChecks.filter((check) => check.status === "disabled").length,
        required: allChecks.filter((check) => check.required).length
      },
      dependencies,
      configuration,
      queues: queueReadiness
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

  private async checkQueues(): Promise<DependencyCheck[]> {
    const required = this.configService.get<boolean>("REDIS_REQUIRED_FOR_READINESS", false);
    const queueHealth = await this.getQueueHealthDetails();
    const redisStatus = this.toCheckStatus(queueHealth.redis.status);
    const redisMessage = queueHealth.redis.lastErrorMessageSafe
      ? `Redis queue transport status is ${queueHealth.redis.status}: ${queueHealth.redis.lastErrorMessageSafe}`
      : `Redis queue transport status is ${queueHealth.redis.status}.`;

    const checks: DependencyCheck[] = [
      {
        key: "redis",
        label: "Redis queues",
        status: redisStatus,
        required,
        message: redisMessage,
        details: {
          status: queueHealth.redis.status,
          lastErrorAt: queueHealth.redis.lastErrorAt,
          lastErrorMessageSafe: queueHealth.redis.lastErrorMessageSafe
        },
        action:
          redisStatus === "operational"
            ? undefined
            : "Check REDIS_URL and queue worker connectivity. If Redis is intentionally disabled, set REDIS_REQUIRED_FOR_READINESS=false."
      }
    ];

    for (const [queueName, state] of Object.entries(queueHealth.queues)) {
      checks.push({
        key: `queue.${queueName}`,
        label: `${queueName} queue`,
        status: this.toCheckStatus(state.status),
        required,
        message:
          state.lastErrorMessageSafe && state.status !== "active"
            ? `${queueName} queue is ${state.status}: ${state.lastErrorMessageSafe}`
            : `${queueName} queue is ${state.status}.`,
        details: {
          status: state.status,
          lastErrorAt: state.lastErrorAt,
          lastErrorMessageSafe: state.lastErrorMessageSafe,
          waitingJobs: state.waitingJobs,
          activeJobs: state.activeJobs,
          delayedJobs: state.delayedJobs,
          failedJobs: state.failedJobs
        },
        action:
          state.status === "active"
            ? undefined
            : "Queue dispatch may be degraded. Check Redis availability and queue workers."
      });
    }

    return checks;
  }

  private async checkObjectStorage(): Promise<DependencyCheck> {
    const required = this.configService.get<boolean>("OBJECT_STORAGE_REQUIRED_FOR_READINESS", false);

    if (this.hasCloudinaryConfig()) {
      return {
        key: "objectStorage",
        label: "Cloudinary file storage",
        status: "operational",
        required,
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
        status: required ? "degraded" : "disabled",
        required,
        message: required
          ? "Object storage is not configured but is required for readiness."
          : "Object storage is disabled because Cloudinary/MinIO/S3 settings are not configured.",
        action: required ? "Set Cloudinary credentials or MINIO_ENDPOINT, MINIO_PORT, and MINIO_BUCKET for uploaded files and reports." : undefined
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
        required,
        latencyMs: this.elapsedMs(startedAt),
        message: `Object storage endpoint is reachable for bucket ${bucket}.`
      };
    } catch (error) {
      return {
        key: "objectStorage",
        label: "Object storage",
        status: "degraded",
        required,
        latencyMs: this.elapsedMs(startedAt),
        message: this.safeErrorMessage(error),
        action: "Start MinIO/S3 or correct MINIO_ENDPOINT and MINIO_PORT."
      };
    }
  }

  private getConfigurationChecks(): ConfigCheck[] {
    return [
      this.integrationModeCheck({
        key: "email",
        label: "Email notifications",
        modeKey: "EMAIL_MODE",
        allowedModes: ["disabled", "live"],
        credentialsForLive: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"],
        liveConfiguredMessage: "Email integration is live and configured.",
        disabledMessage: "Email integration is disabled.",
        liveMissingMessage: "EMAIL_MODE=live but SMTP credentials are incomplete.",
        mockBlockedMessage: "Email integration has no mock mode.",
        actionForLiveMissing: "Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM."
      }),
      this.integrationModeCheck({
        key: "billing",
        label: "Billing / Stripe",
        modeKey: "BILLING_MODE",
        allowedModes: ["disabled", "mock", "live"],
        credentialsForLive: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
        liveConfiguredMessage: "Billing integration is live and Stripe credentials are configured.",
        disabledMessage: "Billing integration is disabled.",
        liveMissingMessage: "BILLING_MODE=live but Stripe credentials are incomplete.",
        mockBlockedMessage: "Billing mock mode is blocked in production unless ALLOW_MOCK_IN_PRODUCTION=true.",
        actionForLiveMissing: "Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET."
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
      this.integrationModeCheck({
        key: "sms",
        label: "SMS provider",
        modeKey: "SMS_MODE",
        allowedModes: ["disabled", "mock", "live"],
        credentialsForLive: ["SMS_API_URL", "SMS_API_KEY", "SMS_SENDER_ID"],
        liveConfiguredMessage: "SMS integration is live and configured.",
        disabledMessage: "SMS integration is disabled.",
        liveMissingMessage: "SMS_MODE=live but SMS provider credentials are incomplete.",
        mockBlockedMessage: "SMS mock mode is blocked in production unless ALLOW_MOCK_IN_PRODUCTION=true.",
        actionForLiveMissing: "Set SMS_API_URL, SMS_API_KEY, and SMS_SENDER_ID."
      }),
      this.integrationModeCheck({
        key: "erp",
        label: "ERP sync provider",
        modeKey: "ERP_MODE",
        allowedModes: ["disabled", "mock", "live"],
        credentialsForLive: ["ERP_API_URL", "ERP_API_KEY"],
        liveConfiguredMessage: "ERP integration is live and configured.",
        disabledMessage: "ERP integration is disabled.",
        liveMissingMessage: "ERP_MODE=live but ERP credentials are incomplete.",
        mockBlockedMessage: "ERP mock mode is blocked in production unless ALLOW_MOCK_IN_PRODUCTION=true.",
        actionForLiveMissing: "Set ERP_API_URL and ERP_API_KEY."
      }),
      this.integrationModeCheck({
        key: "push",
        label: "Push provider",
        modeKey: "PUSH_MODE",
        allowedModes: ["disabled", "mock", "live"],
        credentialsForLive: ["PUSH_PROVIDER_API_URL", "PUSH_PROVIDER_API_KEY"],
        liveConfiguredMessage: "Push integration is live and configured.",
        disabledMessage: "Push integration is disabled.",
        liveMissingMessage: "PUSH_MODE=live but push provider credentials are incomplete.",
        mockBlockedMessage: "Push mock mode is blocked in production unless ALLOW_MOCK_IN_PRODUCTION=true.",
        actionForLiveMissing: "Set PUSH_PROVIDER_API_URL and PUSH_PROVIDER_API_KEY."
      }),
      this.storageModeCheck(),
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

  private integrationModeCheck(options: {
    key: string;
    label: string;
    modeKey: string;
    allowedModes: string[];
    credentialsForLive: string[];
    liveConfiguredMessage: string;
    disabledMessage: string;
    liveMissingMessage: string;
    mockBlockedMessage: string;
    actionForLiveMissing: string;
  }): ConfigCheck {
    const isProduction = this.configService.get<string>("NODE_ENV", "development") === "production";
    const allowMockInProduction = this.configService.get<boolean>("ALLOW_MOCK_IN_PRODUCTION", false);
    const mode = this.configService.get<string>(options.modeKey, options.allowedModes[0]).trim().toLowerCase();
    const isValidMode = options.allowedModes.includes(mode);

    if (!isValidMode) {
      return {
        key: options.key,
        label: options.label,
        status: "misconfigured",
        required: true,
        message: `${options.modeKey} has invalid value "${mode}".`,
        action: `Allowed values: ${options.allowedModes.join(", ")}`
      };
    }

    if (mode === "disabled") {
      return {
        key: options.key,
        label: options.label,
        status: "disabled",
        required: false,
        message: options.disabledMessage
      };
    }

    if (mode === "mock") {
      if (isProduction && !allowMockInProduction) {
        return {
          key: options.key,
          label: options.label,
          status: "misconfigured",
          required: true,
          message: options.mockBlockedMessage,
          action: "Switch to live mode or explicitly allow temporary mocks with ALLOW_MOCK_IN_PRODUCTION=true."
        };
      }

      return {
        key: options.key,
        label: options.label,
        status: "mock",
        required: true,
        message: `${options.label} is running in mock mode.`
      };
    }

    const missing = options.credentialsForLive.filter((key) => !this.hasConfigValue(key));
    if (missing.length > 0) {
      return {
        key: options.key,
        label: options.label,
        status: "misconfigured",
        required: true,
        message: `${options.liveMissingMessage} Missing: ${missing.join(", ")}.`,
        action: options.actionForLiveMissing
      };
    }

    return {
      key: options.key,
      label: options.label,
      status: "operational",
      required: true,
      message: options.liveConfiguredMessage
    };
  }

  private storageModeCheck(): ConfigCheck {
    const storageMode = this.configService.get<string>("STORAGE_MODE", "local").trim().toLowerCase();
    const allowed = ["local", "r2", "s3", "minio", "cloudinary"];
    if (!allowed.includes(storageMode)) {
      return {
        key: "storage",
        label: "Object storage mode",
        status: "misconfigured",
        required: true,
        message: `STORAGE_MODE has invalid value "${storageMode}".`,
        action: "Use one of: local, r2, s3, minio, cloudinary."
      };
    }

    if (storageMode === "local") {
      return {
        key: "storage",
        label: "Object storage mode",
        status: "mock",
        required: false,
        message: "STORAGE_MODE=local uses local/mock storage behavior."
      };
    }

    if (storageMode === "cloudinary") {
      const missing = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"].filter(
        (key) => !this.hasConfigValue(key)
      );
      return missing.length > 0
        ? {
            key: "storage",
            label: "Object storage mode",
            status: "misconfigured",
            required: true,
            message: `STORAGE_MODE=cloudinary is missing: ${missing.join(", ")}.`,
            action: "Configure Cloudinary credentials."
          }
        : {
            key: "storage",
            label: "Object storage mode",
            status: "operational",
            required: true,
            message: "Cloudinary storage mode is configured."
          };
    }

    if (storageMode === "minio") {
      const missing = ["MINIO_ENDPOINT", "MINIO_ACCESS_KEY", "MINIO_SECRET_KEY", "MINIO_BUCKET"].filter(
        (key) => !this.hasConfigValue(key)
      );
      return missing.length > 0
        ? {
            key: "storage",
            label: "Object storage mode",
            status: "misconfigured",
            required: true,
            message: `STORAGE_MODE=minio is missing: ${missing.join(", ")}.`,
            action: "Configure MinIO endpoint, keys, and bucket."
          }
        : {
            key: "storage",
            label: "Object storage mode",
            status: "operational",
            required: true,
            message: "MinIO storage mode is configured."
          };
    }

    return {
      key: "storage",
      label: "Object storage mode",
      status: "degraded",
      required: false,
      message: `STORAGE_MODE=${storageMode} is selected. Direct runtime validation for this mode is not fully implemented.`,
      action: `Validate ${storageMode.toUpperCase()} credentials and upload/download flow in deployment checks.`
    };
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
      const message = sanitizeReplicationError(error);
      if (/SCRAM|AuthenticationFailed|authentication failed/i.test(message)) {
        return "Database authentication failed. Verify the configured MongoDB username, password, authSource, database name, and connection string.";
      }
      if (/timed out|timeout|server selection/i.test(message)) {
        return "Dependency check timed out. Verify network access, service availability, and configured connection timeouts.";
      }
      if (/not configured/i.test(message)) {
        return message;
      }

      return "Dependency check failed. Review server logs for sanitized diagnostic details.";
    }

    return "Dependency check failed.";
  }

  private toCheckStatus(status: "active" | "degraded" | "disabled" | "failed"): CheckStatus {
    if (status === "active") return "operational";
    if (status === "failed") return "failed";
    if (status === "disabled") return "disabled";
    return "degraded";
  }

  private async getQueueHealthDetails(): Promise<{
    mode: "active" | "degraded" | "disabled" | "failed";
    redis: {
      status: "active" | "degraded" | "disabled" | "failed";
      lastErrorAt: string | null;
      lastErrorMessageSafe: string | null;
    };
    queues: Record<
      string,
      {
        status: "active" | "degraded" | "disabled" | "failed";
        lastErrorAt: string | null;
        lastErrorMessageSafe: string | null;
        waitingJobs: number;
        activeJobs: number;
        delayedJobs: number;
        failedJobs: number;
      }
    >;
    totals: {
      waitingJobs: number;
      activeJobs: number;
      delayedJobs: number;
      failedJobs: number;
    };
  }> {
    if (!this.queueHealthService) {
      const redisUrl = this.configService.get<string>("REDIS_URL", "");
      const disabled = !redisUrl.trim();
      return {
        mode: disabled ? "disabled" : "degraded",
        redis: {
          status: disabled ? "disabled" : "degraded",
          lastErrorAt: null,
          lastErrorMessageSafe: disabled ? null : "Queue health monitor is unavailable."
        },
        queues: {},
        totals: {
          waitingJobs: 0,
          activeJobs: 0,
          delayedJobs: 0,
          failedJobs: 0
        }
      };
    }

    return this.queueHealthService.getRedisAndQueueHealth();
  }

  private buildQueueReadinessView(queueHealthDetails: {
    mode: "active" | "degraded" | "disabled" | "failed";
    redis: {
      status: "active" | "degraded" | "disabled" | "failed";
      lastErrorAt: string | null;
      lastErrorMessageSafe: string | null;
    };
    queues: Record<
      string,
      {
        status: "active" | "degraded" | "disabled" | "failed";
        lastErrorAt: string | null;
        lastErrorMessageSafe: string | null;
        waitingJobs: number;
        activeJobs: number;
        delayedJobs: number;
        failedJobs: number;
      }
    >;
    totals: {
      waitingJobs: number;
      activeJobs: number;
      delayedJobs: number;
      failedJobs: number;
    };
  }) {
    const notificationQueue = queueHealthDetails.queues.notification ?? {
      status: queueHealthDetails.mode,
      lastErrorAt: queueHealthDetails.redis.lastErrorAt,
      lastErrorMessageSafe: queueHealthDetails.redis.lastErrorMessageSafe,
      waitingJobs: 0,
      activeJobs: 0,
      delayedJobs: 0,
      failedJobs: 0
    };
    const smtpEnabled = this.configService.get<boolean>("SMTP_ENABLED", false);
    const smsEnabled = this.configService.get<boolean>("SMS_ENABLED", false);
    const pushEnabled = this.configService.get<boolean>("PUSH_PROVIDER_ENABLED", false);

    return {
      mode: queueHealthDetails.mode,
      redis: {
        status: queueHealthDetails.redis.status,
        lastErrorAt: queueHealthDetails.redis.lastErrorAt,
        lastErrorMessageSafe: queueHealthDetails.redis.lastErrorMessageSafe
      },
      queues: {
        notification: notificationQueue,
        ...(smtpEnabled
          ? {
              email: {
                ...notificationQueue,
                sharedQueue: "notification"
              }
            }
          : {}),
        ...(smsEnabled
          ? {
              sms: {
                ...notificationQueue,
                sharedQueue: "notification"
              }
            }
          : {}),
        ...(pushEnabled
          ? {
              push: {
                ...notificationQueue,
                sharedQueue: "notification"
              }
            }
          : {}),
        ...(queueHealthDetails.queues.report
          ? {
              report: queueHealthDetails.queues.report
            }
          : {})
      },
      totals: queueHealthDetails.totals
    };
  }
}