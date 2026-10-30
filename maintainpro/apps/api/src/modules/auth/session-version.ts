/**
 * Per-user session version. Every access and refresh JWT carries the user's
 * `sessionVersion` at issue time (claim `sv`); bumping the column revokes every
 * token issued before the bump, including unexpired access tokens.
 */

/** Spread into a `prisma.user.update({ data })` call to revoke all issued tokens. */
export function bumpSessionVersion(): { sessionVersion: { increment: number } } {
  return { sessionVersion: { increment: 1 } };
}

function toVersion(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0;
}

/** Tokens minted before the column existed carry no claim and count as version 0. */
export function isSessionVersionCurrent(tokenVersion: unknown, userVersion: unknown): boolean {
  return toVersion(tokenVersion) >= toVersion(userVersion);
}

export function currentSessionVersion(user: { sessionVersion?: number | null } | null | undefined): number {
  return toVersion(user?.sessionVersion);
}
