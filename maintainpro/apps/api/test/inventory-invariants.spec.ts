import {
  applyIssueFromAvailable,
  applyIssueFromReserved,
  applyReceive,
  applyRelease,
  applyReserve,
  assertStockInvariants,
  fingerprintSourceFields,
  hashIdempotencyPayload,
  normalizeStockQuantities
} from "../src/modules/inventory/inventory-invariants";

describe("inventory invariants", () => {
  it("keeps AVAILABLE = ON_HAND - RESERVED", () => {
    const qty = applyReceive({ onHand: 0, reserved: 0, available: 0 }, 20);
    expect(qty).toEqual({ onHand: 20, reserved: 0, available: 20 });
    const reserved = applyReserve(qty, 12);
    expect(reserved).toEqual({ onHand: 20, reserved: 12, available: 8 });
    expect(() => applyReserve(reserved, 10)).toThrow(/Insufficient available/);
  });

  it("blocks negative stock and reserved > on hand", () => {
    expect(() => applyIssueFromAvailable({ onHand: 2, reserved: 0, available: 2 }, 3)).toThrow(/Insufficient/);
    expect(() =>
      assertStockInvariants({ onHand: 5, reserved: 6, available: -1 })
    ).toThrow();
  });

  it("issue from reserved does not change available", () => {
    const next = applyIssueFromReserved({ onHand: 20, reserved: 12, available: 8 }, 5);
    expect(next).toEqual({ onHand: 15, reserved: 7, available: 8 });
  });

  it("release restores available", () => {
    const next = applyRelease({ onHand: 20, reserved: 12, available: 8 }, 4);
    expect(next).toEqual({ onHand: 20, reserved: 8, available: 12 });
  });

  it("normalizes missing reserved as zero", () => {
    expect(normalizeStockQuantities({ quantityInStock: 9 })).toEqual({ onHand: 9, reserved: 0, available: 9 });
  });

  it("hashes payloads stably and fingerprints source fields", () => {
    const a = hashIdempotencyPayload({ quantity: 5, partId: "p1", operation: "receive" });
    const b = hashIdempotencyPayload({ operation: "receive", partId: "p1", quantity: 5 });
    const c = hashIdempotencyPayload({ quantity: 9, partId: "p1", operation: "receive" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(fingerprintSourceFields({ sku: "A", qty: 1 })).toHaveLength(64);
  });
});
