/**
 * Phase 15A — transform unit tests (no DB).
 */
import { Prisma } from "@prisma/client";

import {
  coerceDate,
  objectIdToString,
  stringArrayToJsonText,
  toDecimal,
  toJsonText,
  transformDocument
} from "../../../scripts/mongo-to-sqlserver/transforms";

describe("Phase 15A — Mongo→SQL transforms", () => {
  it("converts BSON-like ObjectId and $oid", () => {
    expect(objectIdToString({ $oid: "66f1a2b3c4d5e6f7081920ab" })).toBe("66f1a2b3c4d5e6f7081920ab");
    expect(
      objectIdToString({
        _bsontype: "ObjectId",
        toHexString: () => "aaaaaaaaaaaaaaaaaaaaaaaa",
        toString: () => "aaaaaaaaaaaaaaaaaaaaaaaa"
      })
    ).toBe("aaaaaaaaaaaaaaaaaaaaaaaa");
    expect(objectIdToString("bbbbbbbbbbbbbbbbbbbbbbbb")).toBe("bbbbbbbbbbbbbbbbbbbbbbbb");
  });

  it("converts nested FK ObjectIds without touching dates", () => {
    const createdAt = new Date("2024-01-15T10:00:00.000Z");
    const out = transformDocument({
      _id: { $oid: "111111111111111111111111" },
      tenantId: { $oid: "222222222222222222222222" },
      createdAt,
      name: "Demo"
    });
    expect(out.id).toBe("111111111111111111111111");
    expect(out.tenantId).toBe("222222222222222222222222");
    expect(out.createdAt).toBeInstanceOf(Date);
    expect((out.createdAt as Date).toISOString()).toBe(createdAt.toISOString());
  });

  it("coerces dates from ISO and rejects garbage", () => {
    expect(coerceDate("2024-06-01T00:00:00.000Z")?.toISOString()).toBe("2024-06-01T00:00:00.000Z");
    expect(() => coerceDate("not-a-date")).toThrow();
  });

  it("decimal precision for cost snapshots", () => {
    expect(toDecimal(0)?.toFixed(2)).toBe("0.00");
    expect(toDecimal(10.5)?.toFixed(2)).toBe("10.50");
    expect(toDecimal("123456789.99")?.toFixed(2)).toBe("123456789.99");
    expect(toDecimal(null)).toBeNull();
    const d = toDecimal(10.5)!;
    expect(d).toBeInstanceOf(Prisma.Decimal);
    expect(d.equals(new Prisma.Decimal("10.50"))).toBe(true);
  });

  it("json text round-trip for objects/arrays/unicode/null", () => {
    expect(toJsonText(null)).toBeNull();
    const obj = toJsonText({ a: 1, nest: { b: "ම" } })!;
    expect(JSON.parse(obj)).toEqual({ a: 1, nest: { b: "ම" } });
    const big = { before: { x: "y".repeat(1000) }, after: [1, 2, 3] };
    const text = toJsonText(big)!;
    expect(JSON.parse(text)).toEqual(big);
  });

  it("string arrays become JSON text not JS arrays", () => {
    expect(stringArrayToJsonText(["A", "B"])).toBe('["A","B"]');
    expect(stringArrayToJsonText([])).toBe("[]");
    expect(() => stringArrayToJsonText({ $oid: "no" } as unknown)).toThrow();
  });

  it("transformDocument serializes images array field", () => {
    const out = transformDocument({
      _id: "cccccccccccccccccccccccc",
      images: ["http://a", "http://b"]
    });
    expect(out.images).toBe('["http://a","http://b"]');
  });
});
