import { createHash } from "crypto";

export const DEFAULT_WAREHOUSE_CODE = "DEFAULT";
export const DEFAULT_WAREHOUSE_NAME = "Default Warehouse";

export type StockQuantities = {
  onHand: number;
  reserved: number;
  available: number;
};

export function toNonNegativeInt(value: unknown, label: string): number {
  if (!Number.isFinite(Number(value)) || !Number.isInteger(Number(value))) {
    throw new Error(`${label} must be a whole number`);
  }
  const qty = Number(value);
  if (qty < 0) {
    throw new Error(`${label} cannot be negative`);
  }
  return qty;
}

export function assertPositiveQuantity(quantity: number, label = "Quantity"): void {
  if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
    throw new Error(`${label} must be a whole number greater than 0`);
  }
}

export function deriveAvailable(onHand: number, reserved: number): number {
  return onHand - reserved;
}

export function assertStockInvariants(qty: StockQuantities): void {
  if (qty.onHand < 0) {
    throw new Error("ON_HAND cannot be negative");
  }
  if (qty.reserved < 0) {
    throw new Error("RESERVED cannot be negative");
  }
  if (qty.available !== deriveAvailable(qty.onHand, qty.reserved)) {
    throw new Error("AVAILABLE must equal ON_HAND - RESERVED");
  }
  if (qty.available < 0) {
    throw new Error("AVAILABLE cannot be negative");
  }
  if (qty.reserved > qty.onHand) {
    throw new Error("RESERVED cannot exceed ON_HAND");
  }
}

export function applyReceive(qty: StockQuantities, amount: number): StockQuantities {
  const next = {
    onHand: qty.onHand + amount,
    reserved: qty.reserved,
    available: qty.available + amount
  };
  assertStockInvariants(next);
  return next;
}

export function applyReserve(qty: StockQuantities, amount: number): StockQuantities {
  if (qty.available < amount) {
    throw new Error("Insufficient available stock for reservation");
  }
  const next = {
    onHand: qty.onHand,
    reserved: qty.reserved + amount,
    available: qty.available - amount
  };
  assertStockInvariants(next);
  return next;
}

export function applyRelease(qty: StockQuantities, amount: number): StockQuantities {
  if (qty.reserved < amount) {
    throw new Error("Cannot release more than reserved quantity");
  }
  const next = {
    onHand: qty.onHand,
    reserved: qty.reserved - amount,
    available: qty.available + amount
  };
  assertStockInvariants(next);
  return next;
}

export function applyIssueFromAvailable(qty: StockQuantities, amount: number): StockQuantities {
  if (qty.available < amount || qty.onHand < amount) {
    throw new Error("Insufficient available stock");
  }
  const next = {
    onHand: qty.onHand - amount,
    reserved: qty.reserved,
    available: qty.available - amount
  };
  assertStockInvariants(next);
  return next;
}

export function applyIssueFromReserved(qty: StockQuantities, amount: number): StockQuantities {
  if (qty.reserved < amount || qty.onHand < amount) {
    throw new Error("Insufficient reserved stock to issue");
  }
  const next = {
    onHand: qty.onHand - amount,
    reserved: qty.reserved - amount,
    available: qty.available
  };
  assertStockInvariants(next);
  return next;
}

export function applyReturn(qty: StockQuantities, amount: number): StockQuantities {
  return applyReceive(qty, amount);
}

export function applyAdjustIn(qty: StockQuantities, amount: number): StockQuantities {
  return applyReceive(qty, amount);
}

export function applyAdjustOut(qty: StockQuantities, amount: number): StockQuantities {
  return applyIssueFromAvailable(qty, amount);
}

export function normalizeStockQuantities(input: {
  quantityInStock?: number | null;
  reservedQuantity?: number | null;
  availableQuantity?: number | null;
  onHand?: number | null;
  reserved?: number | null;
  available?: number | null;
}): StockQuantities {
  const onHand = Number(input.onHand ?? input.quantityInStock ?? 0) || 0;
  const reserved = Number(input.reserved ?? input.reservedQuantity ?? 0) || 0;
  return {
    onHand,
    reserved,
    available: deriveAvailable(onHand, reserved)
  };
}

export function hashIdempotencyPayload(payload: Record<string, unknown>): string {
  const stable = Object.keys(payload)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      const value = payload[key];
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {});
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

export function fingerprintSourceFields(fields: Record<string, string | number | null | undefined>): string {
  const stable = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key] ?? ""}`)
    .join("|");
  return createHash("sha256").update(stable).digest("hex");
}
