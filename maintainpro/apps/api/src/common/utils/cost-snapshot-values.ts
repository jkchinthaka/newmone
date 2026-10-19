import { BadRequestException } from "@nestjs/common";

const FIELDS = ["partsCost", "internalLabourCost", "externalServiceCost", "transportCost", "otherCost"] as const;

export type CostSnapshotInput = Partial<Record<(typeof FIELDS)[number], unknown>>;

/** Invalid snapshot numbers are a client error. They are not coerced to zero or NaN. */
export function assertCostSnapshotValues(input: CostSnapshotInput | null | undefined) {
  if (input == null) return;
  for (const field of FIELDS) {
    if (input[field] === undefined || input[field] === null) continue;
    const numeric = typeof input[field] === "number" ? input[field] : Number(input[field]);
    if (!Number.isFinite(numeric) || (numeric as number) < 0) {
      throw new BadRequestException(`${field} must be a non-negative number`);
    }
  }
}
