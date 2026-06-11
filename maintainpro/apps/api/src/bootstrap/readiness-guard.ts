import jwt from "jsonwebtoken";

export interface ReadinessRequestHeaders {
  authorization?: string | string[];
  "x-readiness-key"?: string | string[];
}

export interface ReadinessAuthOptions {
  isProd: boolean;
  accessJwtSecret: string;
  readinessApiKey?: string;
}

/**
 * Detailed readiness exposes dependency/configuration internals (DB replication
 * status, which third-party integrations are configured, etc.) and must not be
 * public in production. Allow either an ADMIN/SUPER_ADMIN bearer token or a
 * shared READINESS_API_KEY (for uptime/infra monitoring that can't hold a JWT).
 */
export function isAuthorizedForReadiness(
  headers: ReadinessRequestHeaders,
  options: ReadinessAuthOptions
): boolean {
  const { isProd, accessJwtSecret, readinessApiKey } = options;
  if (!isProd) return true;

  const providedKey = headers["x-readiness-key"];
  if (readinessApiKey && providedKey === readinessApiKey) {
    return true;
  }

  const authHeader = headers.authorization;
  const token =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : undefined;

  if (!token) return false;

  try {
    const payload = jwt.verify(token, accessJwtSecret) as { role?: string };
    return payload.role === "ADMIN" || payload.role === "SUPER_ADMIN";
  } catch {
    return false;
  }
}
