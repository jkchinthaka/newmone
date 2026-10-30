/**
 * Site GPS centre for the "job photo taken far from the site" check. Inputs are the text boxes
 * in the site dialog; blank latitude and longitude clear the location.
 */
export type SiteGeoDraft = { latitude: string; longitude: string; geoRadiusMeters: string };

export const EMPTY_SITE_GEO: SiteGeoDraft = { latitude: "", longitude: "", geoRadiusMeters: "" };

export function siteGeoDraftFrom(site: { latitude?: number | null; longitude?: number | null; geoRadiusMeters?: number | null }): SiteGeoDraft {
  return {
    latitude: site.latitude == null ? "" : String(site.latitude),
    longitude: site.longitude == null ? "" : String(site.longitude),
    geoRadiusMeters: site.geoRadiusMeters == null ? "" : String(site.geoRadiusMeters)
  };
}

export type SiteGeoPayload = { latitude: number | null; longitude: number | null; geoRadiusMeters: number | null };

export function siteGeoPayload(draft: SiteGeoDraft): { ok: true; value: SiteGeoPayload } | { ok: false; error: string } {
  const lat = draft.latitude.trim();
  const lng = draft.longitude.trim();
  const radius = draft.geoRadiusMeters.trim();
  if (!lat !== !lng) return { ok: false, error: "Enter both latitude and longitude, or leave both empty." };
  const latitude = lat ? Number(lat) : null;
  const longitude = lng ? Number(lng) : null;
  if (latitude !== null && !(Number.isFinite(latitude) && latitude >= -90 && latitude <= 90)) {
    return { ok: false, error: "Latitude must be a number between -90 and 90." };
  }
  if (longitude !== null && !(Number.isFinite(longitude) && longitude >= -180 && longitude <= 180)) {
    return { ok: false, error: "Longitude must be a number between -180 and 180." };
  }
  const geoRadiusMeters = radius ? Number(radius) : null;
  if (geoRadiusMeters !== null && !(Number.isInteger(geoRadiusMeters) && geoRadiusMeters >= 50 && geoRadiusMeters <= 20000)) {
    return { ok: false, error: "Allowed distance must be a whole number of metres from 50 to 20000." };
  }
  return { ok: true, value: { latitude, longitude, geoRadiusMeters } };
}
