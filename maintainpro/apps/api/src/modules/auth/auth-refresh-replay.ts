/** How long a just-rotated refresh token may be presented again without killing the session family. */
export const REFRESH_ROTATION_REPLAY_GRACE_MS = 15_000;

export type RefreshRotationReplayInput = {
  revokedAt: Date | null;
  replacedByTokenHash: string | null;
  familyId: string;
  successor: {
    revokedAt: Date | null;
    expiresAt: Date;
    familyId: string;
  } | null;
  now: Date;
};

/**
 * A refresh that arrives while the browser is still sending the token we just
 * rotated is a race, not theft. The successor must still be the live member of
 * the same family. Older replays remain reuse and revoke the family.
 */
export function isBenignRefreshRotationReplay(input: RefreshRotationReplayInput): boolean {
  if (!input.revokedAt || !input.replacedByTokenHash || !input.successor) {
    return false;
  }
  const ageMs = input.now.getTime() - input.revokedAt.getTime();
  if (ageMs < 0 || ageMs > REFRESH_ROTATION_REPLAY_GRACE_MS) {
    return false;
  }
  if (input.successor.revokedAt) {
    return false;
  }
  if (input.successor.expiresAt.getTime() <= input.now.getTime()) {
    return false;
  }
  return input.successor.familyId === input.familyId;
}
