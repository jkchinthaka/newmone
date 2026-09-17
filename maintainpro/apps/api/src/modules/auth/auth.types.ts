import { RoleName } from "@prisma/client";

/**
 * Access JWT claims. Deliberately compact: this token is stored in a
 * browser cookie (maintainpro_access) and must stay well under the
 * ~4096-byte per-cookie limit. Permissions are NOT included — they are
 * authoritative from the DB only (see PermissionsGuard) and are exposed to
 * the frontend via /auth/me, never via the JWT.
 */
export interface JwtPayload {
  sub: string;
  email: string;
  role: RoleName | string;
  tenantId?: string | null;
}

/**
 * Refresh JWT claims. Smaller than the access token on purpose: role/email
 * are re-resolved from the DB on every refresh (see AuthService.refresh),
 * so the refresh token only needs enough to identify the persisted
 * RefreshToken row and its owner.
 */
export interface RefreshTokenPayload {
  sub: string;
  tenantId?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
