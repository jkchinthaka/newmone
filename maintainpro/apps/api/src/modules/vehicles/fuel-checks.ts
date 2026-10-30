/**
 * Fuel entry checks that stop made-up fuel logs (no database here).
 * - More litres than the tank holds (5% allowance for the filler neck).
 * - A price per litre far from what the company usually pays for that fuel needs a reason.
 */
export const FUEL_TANK_ALLOWANCE = 1.05;
export const FUEL_PRICE_TOLERANCE = 0.15;
/** Price check starts once there are this many earlier fills of the same fuel. */
export const FUEL_PRICE_MIN_HISTORY = 3;

export function median(values: number[]): number | null {
  const sorted = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function fuelEntryProblem(input: {
  liters: number;
  costPerLiter: number;
  tankCapacity?: number | null;
  recentPrices: number[];
  priceReason?: string | null;
}): { message: string; needsPriceReason?: boolean } | null {
  if (!Number.isFinite(input.liters) || input.liters <= 0) return { message: "Litres must be more than 0." };
  if (!Number.isFinite(input.costPerLiter) || input.costPerLiter <= 0) return { message: "Price per litre must be more than 0." };
  const tank = Number(input.tankCapacity ?? 0);
  if (tank > 0 && input.liters > tank * FUEL_TANK_ALLOWANCE) {
    return { message: `${input.liters} L is more than this vehicle's tank holds (${tank} L). Check the litres on the receipt.` };
  }
  const usual = input.recentPrices.length >= FUEL_PRICE_MIN_HISTORY ? median(input.recentPrices) : null;
  if (usual && Math.abs(input.costPerLiter - usual) / usual > FUEL_PRICE_TOLERANCE && String(input.priceReason ?? "").trim().length < 5) {
    return {
      message: `Price LKR ${input.costPerLiter.toFixed(2)} per litre is far from the usual LKR ${usual.toFixed(2)}. Check the receipt, or write why it is different.`,
      needsPriceReason: true
    };
  }
  return null;
}
