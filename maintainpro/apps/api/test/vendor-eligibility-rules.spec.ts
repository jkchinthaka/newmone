import { evaluateVendorEligibility } from "../src/modules/policies/governance-policies";

const now = new Date("2026-09-29T10:00:00.000+05:30");

describe("vendor eligibility", () => {
  it("treats an active vendor with no mandatory documents as eligible", () => {
    const decision = evaluateVendorEligibility({ tenantId: "t1", active: true, blacklisted: false, now });
    expect(decision.eligibility).toBe("ELIGIBLE");
    expect(decision.assignmentAllowed).toBe(true);
    expect(decision.contract.state).toBe("NOT_REQUIRED");
    expect(decision.insurance.state).toBe("NOT_REQUIRED");
  });

  it("blocks inactive and blacklisted vendors, with blocked taking precedence", () => {
    const blocked = evaluateVendorEligibility({ tenantId: "t1", active: false, blacklisted: true, now });
    expect(blocked.availability).toBe("BLOCKED");
    expect(blocked.eligibility).toBe("INELIGIBLE");
    expect(blocked.reasons.map((reason) => reason.code)).toEqual(expect.arrayContaining(["VENDOR_BLOCKED", "VENDOR_INACTIVE"]));
  });

  it("blocks an expired contract and keeps an expiring contract assignable", () => {
    const expired = evaluateVendorEligibility({
      tenantId: "t1",
      active: true,
      blacklisted: false,
      contracts: [{ startDate: new Date("2026-01-01T00:00:00.000+05:30"), endDate: new Date("2026-09-01T00:00:00.000+05:30"), isActive: true }],
      now
    });
    expect(expired.contract.state).toBe("EXPIRED");
    expect(expired.assignmentAllowed).toBe(false);

    const soon = evaluateVendorEligibility({
      tenantId: "t1",
      active: true,
      blacklisted: false,
      contracts: [{ startDate: new Date("2026-01-01T00:00:00.000+05:30"), endDate: new Date("2026-10-10T00:00:00.000+05:30"), isActive: true, reminderDays: 30 }],
      now
    });
    expect(soon.contract.state).toBe("EXPIRING_SOON");
    expect(soon.assignmentAllowed).toBe(true);
  });

  it("needs review when required insurance has no date", () => {
    const decision = evaluateVendorEligibility({
      tenantId: "t1",
      active: true,
      blacklisted: false,
      insuranceRequired: true,
      now
    });
    expect(decision.eligibility).toBe("NEEDS_REVIEW");
    expect(decision.assignmentAllowed).toBe(false);
    expect(decision.reasons.map((reason) => reason.code)).toContain("INSURANCE_MISSING");
  });

  it("does not assign against a contract that has not started", () => {
    const decision = evaluateVendorEligibility({
      tenantId: "t1",
      active: true,
      blacklisted: false,
      contracts: [{ startDate: new Date("2026-10-01T00:00:00.000+05:30"), endDate: new Date("2026-12-01T00:00:00.000+05:30"), isActive: true }],
      now
    });
    expect(decision.contract.state).toBe("NOT_YET_EFFECTIVE");
    expect(decision.eligibility).toBe("NEEDS_REVIEW");
  });
});
