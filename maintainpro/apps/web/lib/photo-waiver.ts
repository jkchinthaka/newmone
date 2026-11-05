/** Same roles the API lets start or finish a job without photos (with a recorded reason). */
const PHOTO_WAIVER_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER"]);

export function canWaivePhotos(role?: string | null): boolean {
  return PHOTO_WAIVER_ROLES.has(String(role ?? "").toUpperCase());
}

export const PHOTO_WAIVER_MIN_REASON = 3;
