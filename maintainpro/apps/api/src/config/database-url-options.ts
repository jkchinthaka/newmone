const DATABASE_URL_KEYS = [
  "PRIMARY_DATABASE_URL",
  "DATABASE_URL",
  "MONGODB_URI",
  "BACKUP_DATABASE_URL"
] as const;

const DEFAULT_SERVER_SELECTION_TIMEOUT_MS = 5_000;
const DEFAULT_CONNECT_TIMEOUT_MS = 5_000;

function integerEnv(value: string | undefined, defaultValue: number, minimum: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.max(minimum, Math.trunc(parsed));
}

export function resolveEnvReference(value: string | undefined, env: NodeJS.ProcessEnv): string | undefined {
  const trimmed = (value ?? "").trim();
  const match = /^\$\{([A-Z0-9_]+)\}$/.exec(trimmed);
  return match ? env[match[1]] : value;
}

export function withMongoConnectionTimeouts(value: string | undefined, env: NodeJS.ProcessEnv): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return trimmed;
  }

  if (url.protocol !== "mongodb:" && url.protocol !== "mongodb+srv:") {
    return trimmed;
  }

  const serverSelectionTimeoutMs = integerEnv(
    env.DATABASE_SERVER_SELECTION_TIMEOUT_MS,
    DEFAULT_SERVER_SELECTION_TIMEOUT_MS,
    500
  );
  const connectTimeoutMs = integerEnv(
    env.DATABASE_CONNECT_TIMEOUT_MS,
    DEFAULT_CONNECT_TIMEOUT_MS,
    500
  );

  if (!url.searchParams.has("serverSelectionTimeoutMS")) {
    url.searchParams.set("serverSelectionTimeoutMS", String(serverSelectionTimeoutMs));
  }

  if (!url.searchParams.has("connectTimeoutMS")) {
    url.searchParams.set("connectTimeoutMS", String(connectTimeoutMs));
  }

  return url.toString();
}

export function normalizeDatabaseEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  if (!env.NODE_ENV && env.RENDER) {
    env.NODE_ENV = "production";
  }

  for (const key of DATABASE_URL_KEYS) {
    const resolved = resolveEnvReference(env[key], env);
    if (resolved) {
      env[key] = withMongoConnectionTimeouts(resolved, env);
    }
  }

  if (!env.PRIMARY_DATABASE_URL && env.DATABASE_URL) {
    env.PRIMARY_DATABASE_URL = env.DATABASE_URL;
  }

  if (!env.DATABASE_URL && env.PRIMARY_DATABASE_URL) {
    env.DATABASE_URL = env.PRIMARY_DATABASE_URL;
  }

  if (!env.DATABASE_URL && env.MONGODB_URI) {
    env.DATABASE_URL = env.MONGODB_URI;
    env.PRIMARY_DATABASE_URL = env.MONGODB_URI;
  }

  if ((!env.MONGODB_URI || env.MONGODB_URI === "${PRIMARY_DATABASE_URL}") && env.DATABASE_URL) {
    env.MONGODB_URI = env.DATABASE_URL;
  }

  for (const key of DATABASE_URL_KEYS) {
    if (env[key]) {
      env[key] = withMongoConnectionTimeouts(env[key], env);
    }
  }

  if (!env.FRONTEND_URL && env.CORS_ORIGIN) {
    env.FRONTEND_URL = String(env.CORS_ORIGIN)
      .split(",")
      .map((value) => value.trim())
      .find(Boolean);
  }
}