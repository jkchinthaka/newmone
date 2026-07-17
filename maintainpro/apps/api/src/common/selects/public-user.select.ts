/**
 * Central public-user projection for API-facing Prisma queries.
 *
 * Never include passwordHash, token metadata, lockout counters, or secrets
 * unless an explicitly authorized security-admin endpoint documents the need.
 */

export const PUBLIC_USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  avatar: true,
  isActive: true,
  designation: true,
  departmentId: true,
  roleId: true,
  tenantId: true
} as const;

/** Public user plus role name for list/detail responses that need RBAC labels. */
export const PUBLIC_USER_WITH_ROLE_SELECT = {
  ...PUBLIC_USER_SELECT,
  role: {
    select: {
      id: true,
      name: true
    }
  }
} as const;

/** Minimal identity for nested relations (assignee, cleaner, uploader, etc.). */
export const PUBLIC_USER_SUMMARY_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true
} as const;

export type PublicUserSelect = typeof PUBLIC_USER_SELECT;
export type PublicUserWithRoleSelect = typeof PUBLIC_USER_WITH_ROLE_SELECT;
export type PublicUserSummarySelect = typeof PUBLIC_USER_SUMMARY_SELECT;

/** Fields that must never appear in API responses without an allowlist exception. */
export const FORBIDDEN_USER_RESPONSE_KEYS = [
  "passwordHash",
  "password",
  "refreshToken",
  "accessToken",
  "tokenHash",
  "resetToken",
  "temporaryPassword",
  "temporaryPasswordExpiresAt",
  "failedLoginAttempts",
  "lockedUntil",
  "apiKey",
  "apiSecret",
  "clientSecret",
  "smtpPass"
] as const;
