import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { assessReleaseMetadata, resolveSafeBuildInfo } from "./common/utils/build-info.util";

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
  build?: {
    version: string;
    commit: string;
    buildTime: string | null;
  };
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
      this.recoveryBackupCheck(),
      this.recoveryRestoreTestCheck(),
      this.configCheck({
        key: "readinessGuard",
        label: "Detailed readiness access guard",
        required: environment === "production",
        configuredMessage: "READINESS_API_KEY or JWT admin access is expected for detailed readiness in production.",
        missingMessage: "Production should protect /health/readiness with READINESS_API_KEY or authenticated admin access.",
        env: ["READINESS_API_KEY"]
      }),
      this.releaseMetadataCheck()
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

    const safe = resolveSafeBuildInfo("maintainpro-api", (key, fallback = "") =>
      this.configService.get<string>(key, fallback)
    );

    return {
      generatedAt: new Date().toISOString(),
      environment,
      overallStatus,
      blockers,
      warnings,
      checks,
      build: {
        version: safe.version,
        commit: safe.commitSha,
        buildTime: safe.buildTimestamp
      }
    };
  }


  /**
   * Independent recoverable backup status (not replication lag).
   * E2E may supply synthetic evidence; production must not rely on E2E alone.
   */
  private recoveryBackupCheck(): DeploymentReadinessItem {
    const environment = this.configService.get<string>("NODE_ENV", "development");
    const required = this.configService.get<boolean>("BACKUP_RESTORE_REQUIRED_FOR_READINESS", false);
    const policyConfigured =
      String(this.configService.get<string>("RECOVERY_BACKUP_POLICY_CONFIGURED", "")).toLowerCase() ===
        "true" ||
      this.configService.get<boolean>("RECOVERY_BACKUP_POLICY_CONFIGURED", false) === true;
    const integrity = String(
      this.configService.get<string>("RECOVERY_LAST_BACKUP_INTEGRITY_STATUS", "unknown")
    ).toLowerCase();
    const ageRaw = this.configService.get<string | number>("RECOVERY_LAST_BACKUP_AGE_HOURS", "");
    const ageHours = ageRaw === "" || ageRaw === undefined || ageRaw === null ? null : Number(ageRaw);
    const e2eEvidence =
      String(this.configService.get<string>("RECOVERY_EVIDENCE_SOURCE", "")).toLowerCase() === "e2e";

    if (environment === "production" && e2eEvidence) {
      return {
        key: "backupPolicyConfigured",
        label: "Recoverable backup policy",
        status: required ? "blocked" : "warning",
        required,
        message: "E2E recovery evidence cannot satisfy production backup readiness.",
        action: "Record production backup integrity evidence outside the application failure domain."
      };
    }

    if (!policyConfigured) {
      return {
        key: "backupPolicyConfigured",
        label: "Recoverable backup policy",
        status: required ? "blocked" : "warning",
        required,
        message: "Independent backup policy evidence is not configured (replication alone is insufficient).",
        action: "Set RECOVERY_BACKUP_POLICY_CONFIGURED and last-backup integrity/age metadata."
      };
    }

    if (integrity !== "valid" && integrity !== "success") {
      return {
        key: "lastBackupIntegrityStatus",
        label: "Last backup integrity",
        status: required ? "blocked" : "warning",
        required,
        message: "Last backup integrity status is not valid.",
        action: "Run a checksum-verified backup and record RECOVERY_LAST_BACKUP_INTEGRITY_STATUS=valid."
      };
    }

    if (ageHours !== null && Number.isFinite(ageHours) && ageHours > 48) {
      return {
        key: "lastBackupAge",
        label: "Last backup age",
        status: "warning",
        required: false,
        message: "Last backup age exceeds provisional 48h freshness window.",
        action: "Create a fresher recoverable backup (MANAGEMENT_APPROVAL_REQUIRED for RPO)."
      };
    }

    return {
      key: "backupPolicyConfigured",
      label: "Recoverable backup policy",
      status: "ready",
      required,
      message: "Recoverable backup policy and integrity evidence are present (separate from replication)."
    };
  }

  private recoveryRestoreTestCheck(): DeploymentReadinessItem {
    const environment = this.configService.get<string>("NODE_ENV", "development");
    const required = this.configService.get<boolean>("BACKUP_RESTORE_REQUIRED_FOR_READINESS", false);
    const status = String(
      this.configService.get<string>("RECOVERY_LAST_RESTORE_TEST_STATUS", "unknown")
    ).toLowerCase();
    const ageRaw = this.configService.get<string | number>("RECOVERY_LAST_RESTORE_TEST_AGE_HOURS", "");
    const ageHours = ageRaw === "" || ageRaw === undefined || ageRaw === null ? null : Number(ageRaw);
    const e2eEvidence =
      String(this.configService.get<string>("RECOVERY_EVIDENCE_SOURCE", "")).toLowerCase() === "e2e";

    if (environment === "production" && e2eEvidence) {
      return {
        key: "lastRestoreTestStatus",
        label: "Last restore rehearsal",
        status: required ? "blocked" : "warning",
        required,
        message: "E2E restore rehearsal cannot mark production restore readiness.",
        action: "Perform an operator-approved restore rehearsal against disposable non-production targets."
      };
    }

    if (status !== "success" && status !== "pass") {
      return {
        key: "lastRestoreTestStatus",
        label: "Last restore rehearsal",
        status: required ? "blocked" : "warning",
        required,
        message: "No successful restore rehearsal evidence is recorded.",
        action: "Complete a fresh-target restore rehearsal and set RECOVERY_LAST_RESTORE_TEST_STATUS=success."
      };
    }

    if (ageHours !== null && Number.isFinite(ageHours) && ageHours > 720) {
      return {
        key: "lastRestoreTestAge",
        label: "Last restore rehearsal age",
        status: "warning",
        required: false,
        message: "Restore rehearsal age exceeds provisional 30-day window.",
        action: "Schedule another restore rehearsal (MANAGEMENT_APPROVAL_REQUIRED for RTO)."
      };
    }

    return {
      key: "lastRestoreTestStatus",
      label: "Last restore rehearsal",
      status: "ready",
      required,
      message: "Restore rehearsal evidence is present and separate from replication status."
    };
  }

  private releaseMetadataCheck(): DeploymentReadinessItem {
    const safe = resolveSafeBuildInfo("maintainpro-api", (key, fallback = "") =>
      this.configService.get<string>(key, fallback)
    );
    const nodeEnv = this.configService.get<string>("NODE_ENV", "development");
    const assessment = assessReleaseMetadata(safe, { nodeEnv });
    const required = assessment.isProductionLike;

    if (assessment.issues.length > 0) {
      return {
        key: "releaseMetadata",
        label: "Release build metadata",
        status: required ? "blocked" : "warning",
        required,
        message: assessment.issues[0],
        action: "Set APP_VERSION, APP_COMMIT_SHA, APP_BUILD_TIMESTAMP, and APP_ENVIRONMENT from the approved release."
      };
    }

    if (assessment.warnings.length > 0) {
      return {
        key: "releaseMetadata",
        label: "Release build metadata",
        status: "warning",
        required,
        message: assessment.warnings[0]
      };
    }

    return {
      key: "releaseMetadata",
      label: "Release build metadata",
      status: "ready",
      required,
      message: "Release metadata is present and acceptable for this environment."
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
