describe("blank optional number conversion", () => {
  function toOptionalNumber(value: unknown): number | undefined {
    if (value === null || value === undefined) return undefined;
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : undefined;
    }
    const raw = String(value).trim();
    if (!raw) return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  it("does not turn blank strings into 0", () => {
    expect(toOptionalNumber("")).toBeUndefined();
    expect(toOptionalNumber("   ")).toBeUndefined();
    expect(Number("")).toBe(0); // documents the bug we avoid
  });

  it("parses valid numbers", () => {
    expect(toOptionalNumber("24")).toBe(24);
    expect(toOptionalNumber(0)).toBe(0);
  });
});