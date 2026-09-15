import { canMeterReadingAdvance } from "../policies/maintenance-policies";

export type MeterReadingValidationInput = {
  previousValue?: number | null;
  nextValue: number;
  lastReadingAt?: Date | null;
  recordedAt?: Date | null;
  now?: Date;
  staleAfterDays?: number;
  jumpWarningThreshold?: number | null;
};

export type MeterReadingValidationResult = {
  accepted: boolean;
  rejected: boolean;
  rejectReason: string | null;
  isStale: boolean;
  suspiciousJump: boolean;
  warnings: string[];
};

/**
 * Validates asset meter readings:
 * - rejects invalid / backwards readings
 * - flags stale when gap exceeds staleAfterDays
 * - warns on suspicious jumps without rejecting
 */
export function validateAssetMeterReading(
  input: MeterReadingValidationInput
): MeterReadingValidationResult {
  const now = input.now ?? new Date();
  const recordedAt = input.recordedAt ?? now;
  const policy = canMeterReadingAdvance({
    previous: input.previousValue,
    next: input.nextValue,
    now,
    recordedAt
  });

  if (!policy.allowed) {
    return {
      accepted: false,
      rejected: true,
      rejectReason: policy.code ?? "METER_INVALID",
      isStale: false,
      suspiciousJump: false,
      warnings: []
    };
  }

  const warnings: string[] = [];
  let isStale = false;
  let suspiciousJump = false;

  const staleAfterDays = input.staleAfterDays ?? 30;
  if (input.lastReadingAt) {
    const gapMs = recordedAt.getTime() - input.lastReadingAt.getTime();
    if (gapMs > staleAfterDays * 24 * 60 * 60 * 1000) {
      isStale = true;
      warnings.push("STALE_READING");
    }
  }

  if (
    input.jumpWarningThreshold != null &&
    input.jumpWarningThreshold > 0 &&
    input.previousValue != null &&
    Number.isFinite(Number(input.previousValue))
  ) {
    const delta = Number(input.nextValue) - Number(input.previousValue);
    if (delta > Number(input.jumpWarningThreshold)) {
      suspiciousJump = true;
      warnings.push("SUSPICIOUS_JUMP");
    }
  }

  return {
    accepted: true,
    rejected: false,
    rejectReason: null,
    isStale,
    suspiciousJump,
    warnings
  };
}
