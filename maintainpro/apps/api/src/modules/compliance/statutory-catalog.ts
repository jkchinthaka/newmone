/**
 * Statutory and safety certificates for non-vehicle assets (boilers, lifts, fire equipment...).
 * Vehicle licence / insurance / emission stay on VehicleDocument.
 * Pure helpers so the rules can be unit tested without a database.
 */
export type StatutoryTypeKey =
  | "BOILER_INSPECTION"
  | "PRESSURE_VESSEL_TEST"
  | "FIRE_EXTINGUISHER_SERVICE"
  | "FIRE_ALARM_TEST"
  | "LIFT_CERTIFICATION"
  | "CRANE_HOIST_LOAD_TEST"
  | "GENERATOR_SERVICE"
  | "ELECTRICAL_EARTHING_TEST"
  | "CALIBRATION"
  | "COLD_ROOM_CALIBRATION"
  | "WATER_QUALITY_TEST"
  | "OTHER";

export interface StatutoryTypeDefinition {
  key: StatutoryTypeKey;
  label: string;
  /** Usual renewal interval in months; the form uses it to suggest an expiry date. */
  defaultIntervalMonths: number;
  /** Days before expiry when the item starts showing as "Due soon". */
  defaultReminderDays: number;
}

export const STATUTORY_TYPES: readonly StatutoryTypeDefinition[] = [
  { key: "BOILER_INSPECTION", label: "Boiler inspection certificate", defaultIntervalMonths: 12, defaultReminderDays: 45 },
  { key: "PRESSURE_VESSEL_TEST", label: "Pressure vessel / air receiver test", defaultIntervalMonths: 12, defaultReminderDays: 45 },
  { key: "FIRE_EXTINGUISHER_SERVICE", label: "Fire extinguisher service", defaultIntervalMonths: 12, defaultReminderDays: 30 },
  { key: "FIRE_ALARM_TEST", label: "Fire alarm / sprinkler test", defaultIntervalMonths: 6, defaultReminderDays: 21 },
  { key: "LIFT_CERTIFICATION", label: "Lift certification", defaultIntervalMonths: 12, defaultReminderDays: 45 },
  { key: "CRANE_HOIST_LOAD_TEST", label: "Crane / hoist load test", defaultIntervalMonths: 12, defaultReminderDays: 45 },
  { key: "GENERATOR_SERVICE", label: "Generator service", defaultIntervalMonths: 6, defaultReminderDays: 21 },
  { key: "ELECTRICAL_EARTHING_TEST", label: "Electrical / earthing test", defaultIntervalMonths: 12, defaultReminderDays: 30 },
  { key: "CALIBRATION", label: "Instrument calibration", defaultIntervalMonths: 12, defaultReminderDays: 30 },
  { key: "COLD_ROOM_CALIBRATION", label: "Cold room / chiller calibration", defaultIntervalMonths: 12, defaultReminderDays: 30 },
  { key: "WATER_QUALITY_TEST", label: "Water quality test", defaultIntervalMonths: 6, defaultReminderDays: 21 },
  { key: "OTHER", label: "Other certificate", defaultIntervalMonths: 12, defaultReminderDays: 30 }
] as const;

export const STATUTORY_SUBJECT_TYPE = "ASSET";

export type StatutoryState = "VALID" | "DUE_SOON" | "EXPIRED";

const DAY_MS = 24 * 60 * 60 * 1000;

export function isStatutoryTypeKey(value: string): value is StatutoryTypeKey {
  return STATUTORY_TYPES.some((type) => type.key === value);
}

export function statutoryLabel(key: string): string {
  return STATUTORY_TYPES.find((type) => type.key === key)?.label ?? key;
}

const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const colomboDayNumber = (date: Date) => Math.floor((date.getTime() + COLOMBO_OFFSET_MS) / DAY_MS);

/** Calendar days from today to the expiry day in Sri Lanka (0 = expires today, negative once past). */
export function daysUntil(expiresAt: Date, now: Date = new Date()): number {
  return colomboDayNumber(expiresAt) - colomboDayNumber(now);
}

export function statutoryState(expiresAt: Date, reminderDays: number, now: Date = new Date()): StatutoryState {
  const days = daysUntil(expiresAt, now);
  if (days < 0) return "EXPIRED";
  if (days <= reminderDays) return "DUE_SOON";
  return "VALID";
}

export function summarizeStates(states: readonly StatutoryState[]) {
  return {
    total: states.length,
    valid: states.filter((s) => s === "VALID").length,
    dueSoon: states.filter((s) => s === "DUE_SOON").length,
    expired: states.filter((s) => s === "EXPIRED").length
  };
}
