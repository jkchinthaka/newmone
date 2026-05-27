export type DatabaseReplicationMode = "async_outbox" | "strict_dual_write" | "disabled";

export interface DatabaseReplicationConfig {
  enabled: boolean;
  mode: DatabaseReplicationMode;
  retryAttempts: number;
  retryDelayMs: number;
  batchSize: number;
  backupRequiredForReadiness: boolean;
  backupRequiredForStrictMode: boolean;
  primaryDatabaseUrl: string;
  backupDatabaseUrl: string;
  primaryDatabaseName: string;
  backupDatabaseName: string;
}

function normalizeMode(value: string | undefined): DatabaseReplicationMode {
  const normalized = (value ?? "async_outbox").trim().toLowerCase();
  if (normalized === "strict_dual_write" || normalized === "disabled") return normalized;
  return "async_outbox";
}

function booleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function integerEnv(value: string | undefined, defaultValue: number, minimum: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.max(minimum, Math.trunc(parsed));
}

function resolveEnvReference(value: string | undefined, env: NodeJS.ProcessEnv): string {
  const trimmed = (value ?? "").trim();
  const match = /^\$\{([A-Z0-9_]+)\}$/.exec(trimmed);
  if (!match) return trimmed;
  return (env[match[1]] ?? "").trim();
}

export function getDatabaseReplicationConfig(env: NodeJS.ProcessEnv = process.env): DatabaseReplicationConfig {
  const mode = normalizeMode(env.DATABASE_REPLICATION_MODE);
  const explicitEnabled = booleanEnv(env.DATABASE_REPLICATION_ENABLED, true);
  const primaryDatabaseUrl =
    resolveEnvReference(env.PRIMARY_DATABASE_URL, env) ||
    resolveEnvReference(env.DATABASE_URL, env) ||
    resolveEnvReference(env.MONGODB_URI, env);

  return {
    enabled: explicitEnabled && mode !== "disabled",
    mode,
    retryAttempts: integerEnv(env.DATABASE_REPLICATION_RETRY_ATTEMPTS, 5, 1),
    retryDelayMs: integerEnv(env.DATABASE_REPLICATION_RETRY_DELAY_MS, 5000, 250),
    batchSize: integerEnv(env.DATABASE_REPLICATION_BATCH_SIZE, 100, 1),
    backupRequiredForReadiness: booleanEnv(env.BACKUP_DATABASE_REQUIRED_FOR_READINESS, false),
    backupRequiredForStrictMode: booleanEnv(env.BACKUP_DATABASE_REQUIRED_FOR_STRICT_MODE, true),
    primaryDatabaseUrl,
    backupDatabaseUrl: resolveEnvReference(env.BACKUP_DATABASE_URL, env),
    primaryDatabaseName: env.PRIMARY_DATABASE_NAME || env.MONGO_DATABASE_NAME || "",
    backupDatabaseName: env.BACKUP_DATABASE_NAME || ""
  };
}

export function maskDatabaseUrl(value: string | null | undefined): string {
  if (!value) return "";

  try {
    const url = new URL(value);
    if (url.username) url.username = "<username>";
    if (url.password) url.password = "<password>";
    return url.toString();
  } catch {
    return value.replace(/:\/\/([^:/@]+):([^@]+)@/g, "://<username>:<password>@");
  }
}

export function sanitizeReplicationError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return maskDatabaseUrl(message).slice(0, 2000);
}