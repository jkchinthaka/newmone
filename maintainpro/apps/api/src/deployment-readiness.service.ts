import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type DeploymentReadinessStatus = "ready" | "warning" | "blocked";

export type DeploymentReadinessItem = {
  key: string;
  label: string;
  status: DeploymentReadinessStatus;
  required: boolean;
  message: string;
  action?: string;
};

export type DeploymentReadinessSummary = {
  generatedAt: string;
  environment: string;
  overallStatus: DeploymentReadinessStatus;
  blockers: string[];
  warnings: string[];
  checks: DeploymentReadinessItem[];
};

@Injectable()
export class DeploymentReadinessService {
  constructor(private readonly configService: ConfigService) {}

  getSummary(input?: {
    databaseStatus?: "operational" | "degraded" | "failed";
    redisStatus?: "operational" | "degraded" | "failed" | "disabled";
    emailState?: string;
    smsState?: string;
    erpState?: string;
    objectStorageStatus?: string;
  }): DeploymentReadinessSummary {
    const environment = this.configService.get<string>("NODE_ENV", "development");
    const checks: DeploymentReadinessItem[] = [
      this.databaseCheck(input?.databaseStatus),
      this.redisCheck(input?.redisStatus),
      this.secretCheck("jwt", "JWT access/refresh secrets", ["JWT_SECRET", "JWT_ACCESS_SECRET"], true),
      this.secretCheck("cors", "CORS / frontend URLs", ["CORS_ORIGIN", "FRONTEND_URL"], true),
      this.integrationCheck("email", "Email notifications", input?.emailState, false),
      this.integrationCheck("sms", "SMS notifications", input?.smsState, false),
      this.integrationCheck("erp", "ERP inventory integration", input?.erpState, false),
      this.objectStorageCheck(input?.objectStorageStatus),
      this.configCheck({
        key: "backupReplication",
        label: "Backup replication policy",
        required: this.configService.get<boolean>("BACKUP_DATABASE_REQUIRED_FOR_READINESS", false),
        configuredMessage: "Backup replication requirement is explicitly configured.",
        missingMessage: "Backup replication is required for readiness but backup URL/policy is incomplete.",
        env: ["BACKUP_DATABASE_URL"]
      }),
      this.configCheck({
        key: "readinessGuard",
        label: "Detailed readiness access guard",
        required: environment === "production",
        configuredMessage: "READINESS_API_KEY or JWT admin access is expected for detailed readiness in production.",
        missingMessage: "Production should protect /health/readiness with READINESS_API_KEY or authenticated admin access.",
        env: ["READINESS_API_KEY"]
      })
    ];

    const blockers = checks
      .filter((check) => check.required && check.status === "blocked")
      .map((check) => check.message);
    const warnings = checks
      .filter((check) => check.status === "warning" || (!check.required && check.status === "blocked"))
      .map((check) => check.message);

    const overallStatus: DeploymentReadinessStatus = blockers.length
      ? "blocked"
      : warnings.length
        ? "warning"
        : "ready";

    return {
      generatedAt: new Date().toISOString(),
      environment,
      overallStatus,
      blockers,
      warnings,
      checks
    };
  }

  private databaseCheck(
    status: "operational" | "degraded" | "failed" | undefined
  ): DeploymentReadinessItem {
    const required = true;
    if (status === "operational") {
      return {
        key: "database",
        label: "Primary database",
        status: "ready",
        required,
        message: "Primary database connectivity is operational."
      };
    }

    if (status === "degraded") {
      return {
        key: "database",
        label: "Primary database",
        status: "warning",
        required,
        message: "Primary database is reachable but degraded.",
        action: "Review database latency, replication lag, and connection pool saturation."
      };
    }

    return {
      key: "database",
      label: "Primary database",
      status: status === "failed" ? "blocked" : "warning",
      required,
      message:
        status === "failed"
          ? "Primary database connectivity failed."
          : "Primary database status has not been evaluated.",
      action: "Verify PRIMARY_DATABASE_URL / DATABASE_URL and MongoDB availability."
    };
  }

  private redisCheck(
    status: "operational" | "degraded" | "failed" | "disabled" | undefined
  ): DeploymentReadinessItem {
    const required =
      this.configService.get<string>("NODE_ENV", "development") === "production" &&
      this.configService.get<boolean>("REDIS_REQUIRED_IN_PRODUCTION", true);

    if (status === "operational") {
      return {
        key: "redis",
        label: "Redis / background queues",
        status: "ready",
        required,
        message: "Redis queue backend is operational."
      };
    }

    if (status === "disabled" && !required) {
      return {
        key: "redis",
        label: "Redis / background queues",
        status: "warning",
        required,
        message: "Redis is disabled; queue-backed notifications and jobs will degrade gracefully.",
        action: "Configure REDIS_URL before production if queue delivery is required."
      };
    }

    return {
      key: "redis",
      label: "Redis / background queues",
      status: required ? "blocked" : "warning",
      required,
      message:
        status === "failed"
          ? "Redis connectivity failed."
          : "Redis / queue readiness has not passed or is unavailable.",
      action: "Verify REDIS_URL and Bull queue health."
    };
  }

  private integrationCheck(
    key: string,
    label: string,
    state: string | undefined,
    required: boolean
  ): DeploymentReadinessItem {
    const normalized = String(state ?? "unknown").toLowerCase();
    if (normalized === "configured") {
      return { key, label, status: "ready", required, message: `${label} is configured.` };
    }

    if (normalized === "disabled") {
      return {
        key,
        label,
        status: required ? "blocked" : "warning",
        required,
        message: `${label} is disabled.`,
        action: required ? `Configure ${label.toLowerCase()} before go-live.` : undefined
      };
    }

    if (normalized === "misconfigured" || normalized === "not_configured") {
      return {
        key,
        label,
        status: required ? "blocked" : "warning",
        required,
        message: `${label} is ${normalized.replace(/_/g, " ")}.`,
        action: `Review provider env vars and readiness docs before enabling live mode.`
      };
    }

    return {
      key,
      label,
      status: "warning",
      required,
      message: `${label} readiness has not been evaluated.`,
      action: "Run deployment readiness checks after API boot."
    };
  }

  private objectStorageCheck(status: string | undefined): DeploymentReadinessItem {
    const required = this.configService.get<boolean>("OBJECT_STORAGE_REQUIRED_FOR_READINESS", false);
    const storageMode = this.configService.get<string>("STORAGE_MODE", "local").trim().toLowerCase();

    if (status === "operational") {
      return {
        key: "objectStorage",
        label: "Object storage",
        status: "ready",
        required,
        message: "Object storage readiness passed."
      };
    }

    if (storageMode === "local" && !required) {
      return {
        key: "objectStorage",
        label: "Object storage",
        status: "warning",
        required,
        message: "Object storage is in local mode; uploaded files will not survive multi-instance production.",
        action: "Configure Cloudinary, MinIO, R2, or S3 before production file uploads."
      };
    }

    return {
      key: "objectStorage",
      label: "Object storage",
      status: required ? "blocked" : "warning",
      required,
      message: "Object storage is not ready for production file workloads.",
      action: "Configure storage provider credentials and verify bucket reachability."
    };
  }

  private secretCheck(
    key: string,
    label: string,
    envKeys: string[],
    required: boolean
  ): DeploymentReadinessItem {
    const hasAny = envKeys.some((envKey) => this.hasConfigValue(envKey));
    if (hasAny) {
      return {
        key,
        label,
        status: "ready",
        required,
        message: `${label} are configured.`
      };
    }

    return {
      key,
      label,
      status: required ? "blocked" : "warning",
      required,
      message: `${label} are missing.`,
      action: `Set one of: ${envKeys.join(", ")}`
    };
  }

  private configCheck(input: {
    key: string;
    label: string;
    required: boolean;
    configuredMessage: string;
    missingMessage: string;
    env: string[];
  }): DeploymentReadinessItem {
    const configured = input.env.every((envKey) => this.hasConfigValue(envKey));
    return {
      key: input.key,
      label: input.label,
      status: configured ? "ready" : input.required ? "blocked" : "warning",
      required: input.required,
      message: configured ? input.configuredMessage : input.missingMessage,
      action: configured ? undefined : `Set ${input.env.join(", ")}`
    };
  }

  private hasConfigValue(key: string): boolean {
    const value = this.configService.get<string | number | boolean | undefined>(key);
    return value !== undefined && String(value).trim().length > 0;
  }
}
