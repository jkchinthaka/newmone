/**
 * Rule-based field checks for the fraud-control report (not AI):
 * - a labour session much longer than a normal shift (forgotten timer or padded hours);
 * - a job photo taken far from the site where the job is.
 */
export const LONG_LABOUR_HOURS_DEFAULT = 12;
export const SITE_RADIUS_METERS_DEFAULT = 500;

const EARTH_RADIUS_METERS = 6_371_000;

export function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Minutes the session counts for: corrected minutes win, then stored minutes, then still-running time. */
export function labourSessionMinutes(
  entry: { startedAt: Date; endedAt?: Date | null; durationMinutes?: number | null; correctedDurationMinutes?: number | null },
  now: Date = new Date()
): number {
  if (entry.correctedDurationMinutes != null) return Number(entry.correctedDurationMinutes);
  if (entry.durationMinutes != null) return Number(entry.durationMinutes);
  const end = entry.endedAt ?? now;
  return Math.max(0, Math.round((end.getTime() - entry.startedAt.getTime()) / 60_000));
}

export function isLongLabourSession(minutes: number, limitHours = LONG_LABOUR_HOURS_DEFAULT): boolean {
  return minutes > limitHours * 60;
}

/**
 * True when the photo was taken outside the site radius. The phone's own accuracy is added to the
 * radius so a poor GPS fix near the edge is not flagged.
 */
export function isPhotoFarFromSite(input: {
  photo: { latitude: number; longitude: number; accuracyMeters?: number | null };
  site: { latitude: number; longitude: number; radiusMeters?: number | null };
}): { far: boolean; distanceMeters: number; allowedMeters: number } {
  const distance = distanceMeters(input.photo, input.site);
  const allowed = (input.site.radiusMeters ?? SITE_RADIUS_METERS_DEFAULT) + Math.max(0, Number(input.photo.accuracyMeters ?? 0));
  return { far: distance > allowed, distanceMeters: Math.round(distance), allowedMeters: Math.round(allowed) };
}
