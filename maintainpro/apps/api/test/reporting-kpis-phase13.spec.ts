/**
 * Phase 13 — Reporting KPIs test suite
 *
 * Covers: KPI formula helpers with exact fixture values, role home profiles,
 * domain applicability, RBAC catalog, N/A ≠ 0 invariants, overdue logic, and
 * shared-home navigation assertion.
 *
 * All formula helpers are pure functions — no Prisma, no HTTP.
 */

import {
  computeAvailability,
  computeBacklogAging,
  computeBacklogCount,
  computeComplianceRate,
  computeCostPerKm,
  computeDowntimeMinutes,
  computeFleetServiceCompliance,
  computeMaintenanceCost,
  computeMtbf,
  computeMttr,
  computeOverdueCount,
  computePlannedVsReactive,
  computePmCompliance,
  computeRepeatFailures,
  computeResponseTimeHours,
  getKpiDefinition,
  isKpiApplicableForDomain,
  isTerminalStatus,
  KPI_DEFINITIONS,
  KPI_FORMULA_VERSION,
  TERMINAL_WO_STATUSES
} from "../src/modules/reporting-kpis/kpi-definitions";
import { resolveRoleHome, ROLE_HOME_PROFILES } from "../src/modules/reporting-kpis/role-home";
import { PERMISSION_CATALOG } from "../src/database/permission-catalog";
import { NAVIGATION_ITEMS } from "../../web/lib/navigation";
import { isKpiApplicable } from "../src/modules/asset-taxonomy/domain-profiles";

// ──────────────────────────────────────────────────────────────────────────────
// 1. KPI Catalog meta
// ──────────────────────────────────────────────────────────────────────────────

describe("KPI catalog meta", () => {
  it("has a versioned formula version string starting with 2026-", () => {
    expect(KPI_FORMULA_VERSION).toMatch(/^2026-/);
  });

  it("has at least 15 KPI definitions", () => {
    expect(KPI_DEFINITIONS.length).toBeGreaterThanOrEqual(15);
  });

  it("every definition has a non-empty formulaSummary (tooltip text)", () => {
    for (const d of KPI_DEFINITIONS) {
      expect(d.formulaSummary.length).toBeGreaterThan(0);
    }
  });

  it("back-compat: key, label, formula, help fields match code, displayName, formulaSummary, description", () => {
    for (const d of KPI_DEFINITIONS) {
      expect(d.key).toBe(d.code);
      expect(d.label).toBe(d.displayName);
      expect(d.formula).toBe(d.formulaSummary);
      expect(d.help).toBe(d.description);
    }
  });

  it("getKpiDefinition returns correct definition by code", () => {
    const mttr = getKpiDefinition("MTTR");
    expect(mttr).toBeDefined();
    expect(mttr!.displayName).toBe("Mean Time To Repair");
    expect(mttr!.formulaSummary).toContain("repairCompletedAt");
  });

  it("getKpiDefinition is case-insensitive", () => {
    expect(getKpiDefinition("mttr")).toBeDefined();
    expect(getKpiDefinition("MTBF")).toBeDefined();
  });

  it("getKpiDefinition returns undefined for unknown code", () => {
    expect(getKpiDefinition("UNKNOWN_XYZ")).toBeUndefined();
  });

  it("MTBF has emptyBehavior INSUFFICIENT_DATA (not ZERO)", () => {
    const mtbf = getKpiDefinition("MTBF");
    expect(mtbf!.emptyBehavior).toBe("INSUFFICIENT_DATA");
  });

  it("catalog contains all required Phase 13 codes", () => {
    const codes = KPI_DEFINITIONS.map((d) => d.code);
    const required = [
      "WO_OVERDUE", "WO_BACKLOG", "PM_COMPLIANCE", "PLANNED_VS_REACTIVE",
      "MTTR", "MTBF", "AVAILABILITY", "DOWNTIME", "RESPONSE_TIME",
      "REPEAT_FAILURE", "MAINTENANCE_COST", "COST_PER_KM",
      "FLEET_SERVICE_COMPLIANCE", "BUILDING_BACKLOG", "COMPLIANCE_RATE"
    ];
    for (const code of required) {
      expect(codes).toContain(code);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. Terminal status / overdue logic
// ──────────────────────────────────────────────────────────────────────────────

describe("Terminal status and overdue logic", () => {
  it("CLOSED and CANCELLED are terminal statuses", () => {
    expect(isTerminalStatus("CLOSED")).toBe(true);
    expect(isTerminalStatus("CANCELLED")).toBe(true);
  });

  it("OPEN, IN_PROGRESS, ON_HOLD are non-terminal", () => {
    expect(isTerminalStatus("OPEN")).toBe(false);
    expect(isTerminalStatus("IN_PROGRESS")).toBe(false);
    expect(isTerminalStatus("ON_HOLD")).toBe(false);
  });

  it("isTerminalStatus is case-insensitive", () => {
    expect(isTerminalStatus("closed")).toBe(true);
    expect(isTerminalStatus("Cancelled")).toBe(true);
  });

  it("TERMINAL_WO_STATUSES array includes CLOSED and CANCELLED", () => {
    expect(TERMINAL_WO_STATUSES).toContain("CLOSED");
    expect(TERMINAL_WO_STATUSES).toContain("CANCELLED");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. computeOverdueCount — fixture tests
// ──────────────────────────────────────────────────────────────────────────────

describe("computeOverdueCount", () => {
  const now = new Date("2026-09-15T10:00:00Z");
  const yesterday = new Date("2026-09-14T10:00:00Z");
  const tomorrow = new Date("2026-09-16T10:00:00Z");

  it("OPEN WO due yesterday counts as overdue", () => {
    const wos = [{ dueAt: yesterday, status: "OPEN" }];
    expect(computeOverdueCount(wos, now)).toBe(1);
  });

  it("CLOSED WO due yesterday does NOT count as overdue", () => {
    const wos = [{ dueAt: yesterday, status: "CLOSED" }];
    expect(computeOverdueCount(wos, now)).toBe(0);
  });

  it("CANCELLED WO due yesterday does NOT count as overdue", () => {
    const wos = [{ dueAt: yesterday, status: "CANCELLED" }];
    expect(computeOverdueCount(wos, now)).toBe(0);
  });

  it("OPEN WO due tomorrow does NOT count as overdue", () => {
    const wos = [{ dueAt: tomorrow, status: "OPEN" }];
    expect(computeOverdueCount(wos, now)).toBe(0);
  });

  it("WO with null dueAt never counts as overdue", () => {
    const wos = [{ dueAt: null, status: "OPEN" }];
    expect(computeOverdueCount(wos, now)).toBe(0);
  });

  it("mixed batch: only non-terminal past-due count", () => {
    const wos = [
      { dueAt: yesterday, status: "OPEN" },       // overdue
      { dueAt: yesterday, status: "IN_PROGRESS" }, // overdue
      { dueAt: yesterday, status: "CLOSED" },      // NOT overdue
      { dueAt: tomorrow,  status: "OPEN" },        // not past due
      { dueAt: null,      status: "OPEN" }         // no due date
    ];
    expect(computeOverdueCount(wos, now)).toBe(2);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. computeBacklogCount
// ──────────────────────────────────────────────────────────────────────────────

describe("computeBacklogCount", () => {
  it("excludes CLOSED and CANCELLED", () => {
    const wos = [
      { status: "OPEN" },
      { status: "IN_PROGRESS" },
      { status: "ON_HOLD" },
      { status: "CLOSED" },
      { status: "CANCELLED" }
    ];
    expect(computeBacklogCount(wos)).toBe(3);
  });

  it("returns 0 when all WOs are terminal", () => {
    expect(computeBacklogCount([{ status: "CLOSED" }, { status: "CANCELLED" }])).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 5. computePmCompliance — fixture
// ──────────────────────────────────────────────────────────────────────────────

describe("computePmCompliance", () => {
  /**
   * Fixture: 10 due, 8 on-time, 1 late (not on-time), 1 cancelled (excluded).
   * Denominator = 9 (10 due - 1 cancelled = 9 if cancelled excluded),
   * OR denominator = 10 if late still counts toward due.
   *
   * Per spec: cancelled excluded from both numerator and denominator.
   * If 9 due (after excluding cancelled), 8 on-time → 88.9%
   * If 10 due (no cancellation in due count), 8 on-time → 80%.
   *
   * The caller pre-computes dueCount excluding cancelled. Here we test:
   * 8 on-time / 10 due = 80.0 (doc: late PMs are not on-time)
   */
  it("8 on-time / 10 due = 80%", () => {
    expect(computePmCompliance(8, 10)).toBeCloseTo(80);
  });

  it("returns null when dueCount is 0 (no data, not 0%)", () => {
    expect(computePmCompliance(0, 0)).toBeNull();
    expect(computePmCompliance(5, 0)).toBeNull();
  });

  it("100% when all are on-time", () => {
    expect(computePmCompliance(5, 5)).toBeCloseTo(100);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 6. computePlannedVsReactive
// ──────────────────────────────────────────────────────────────────────────────

describe("computePlannedVsReactive", () => {
  it("counts planned and reactive correctly", () => {
    const wos = [
      { type: "PREVENTIVE", status: "OPEN" },
      { type: "SCHEDULED", status: "CLOSED" },
      { type: "CORRECTIVE", status: "OPEN" },
      { type: "EMERGENCY", status: "OPEN" },
      { type: "PREVENTIVE", status: "OPEN" }
    ];
    const result = computePlannedVsReactive(wos);
    expect(result.plannedCount).toBe(3);
    expect(result.reactiveCount).toBe(2);
    expect(result.plannedPct).toBeCloseTo(60);
  });

  it("excludes CANCELLED from totals", () => {
    const wos = [
      { type: "PREVENTIVE", status: "OPEN" },
      { type: "CORRECTIVE", status: "CANCELLED" }
    ];
    const result = computePlannedVsReactive(wos);
    expect(result.plannedCount).toBe(1);
    expect(result.reactiveCount).toBe(0);
    expect(result.plannedPct).toBeCloseTo(100);
  });

  it("returns null plannedPct when no WOs", () => {
    expect(computePlannedVsReactive([]).plannedPct).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 7. computeMttr — fixture
// ──────────────────────────────────────────────────────────────────────────────

describe("computeMttr", () => {
  it("average of valid durations: [2, 4, 6] = 4h", () => {
    expect(computeMttr([2, 4, 6])).toBe(4);
  });

  it("returns null for empty array", () => {
    expect(computeMttr([])).toBeNull();
  });

  it("filters out zero/negative/non-finite values (invalid repair intervals)", () => {
    // 0 and -1 are invalid (end <= start); Infinity is non-finite
    expect(computeMttr([0, -1, Infinity, 3, 5])).toBeCloseTo(4);
  });

  it("returns null when only invalid durations provided", () => {
    expect(computeMttr([0, -2])).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 8. computeMtbf — N/A ≠ 0 invariant
// ──────────────────────────────────────────────────────────────────────────────

describe("computeMtbf", () => {
  it("1000 operating hours / 5 failures = 200h", () => {
    expect(computeMtbf(1000, 5)).toBe(200);
  });

  it("returns null (INSUFFICIENT_DATA) when operatingHours is null", () => {
    // N/A ≠ 0: no meter data means insufficient data, not zero MTBF
    expect(computeMtbf(null, 5)).toBeNull();
  });

  it("returns null when operatingHours is undefined", () => {
    expect(computeMtbf(undefined, 5)).toBeNull();
  });

  it("returns null when failureCount is 0", () => {
    expect(computeMtbf(1000, 0)).toBeNull();
  });

  it("returns null when operatingHours is 0", () => {
    expect(computeMtbf(0, 5)).toBeNull();
  });

  it("returns null when operatingHours is negative", () => {
    expect(computeMtbf(-100, 5)).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 9. computeAvailability
// ──────────────────────────────────────────────────────────────────────────────

describe("computeAvailability", () => {
  it("(100 - 10) / 100 = 0.9", () => {
    expect(computeAvailability(100, 10)).toBeCloseTo(0.9);
  });

  it("returns null when scheduledHours = 0", () => {
    expect(computeAvailability(0, 0)).toBeNull();
  });

  it("clamps negative downtime to 0", () => {
    expect(computeAvailability(100, -10)).toBeCloseTo(1.0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 10. computeDowntimeMinutes
// ──────────────────────────────────────────────────────────────────────────────

describe("computeDowntimeMinutes", () => {
  it("sums intervals: 60min + 30min = 90min", () => {
    const intervals = [
      { startMs: 0, endMs: 60 * 60_000 },      // 60 min
      { startMs: 0, endMs: 30 * 60_000 }        // 30 min
    ];
    expect(computeDowntimeMinutes(intervals)).toBeCloseTo(90);
  });

  it("returns 0 for empty intervals", () => {
    expect(computeDowntimeMinutes([])).toBe(0);
  });

  it("clamps negative intervals to 0", () => {
    const intervals = [{ startMs: 100, endMs: 50 }];
    expect(computeDowntimeMinutes(intervals)).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 11. computeResponseTimeHours
// ──────────────────────────────────────────────────────────────────────────────

describe("computeResponseTimeHours", () => {
  it("avg of 1h and 3h = 2h", () => {
    const t0 = new Date("2026-09-15T08:00:00Z");
    const pairs = [
      { reportedAt: t0, acknowledgedAt: new Date("2026-09-15T09:00:00Z") }, // 1h
      { reportedAt: t0, acknowledgedAt: new Date("2026-09-15T11:00:00Z") }  // 3h
    ];
    expect(computeResponseTimeHours(pairs)).toBeCloseTo(2);
  });

  it("returns null for empty array", () => {
    expect(computeResponseTimeHours([])).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 12. computeRepeatFailures
// ──────────────────────────────────────────────────────────────────────────────

describe("computeRepeatFailures", () => {
  const now = new Date("2026-09-15T00:00:00Z");

  it("counts pairs with ≥2 occurrences in window", () => {
    const events = [
      { assetId: "A1", failureCode: "FC1", occurredAt: new Date("2026-09-10T00:00:00Z") },
      { assetId: "A1", failureCode: "FC1", occurredAt: new Date("2026-09-12T00:00:00Z") }, // repeat!
      { assetId: "A2", failureCode: "FC1", occurredAt: new Date("2026-09-13T00:00:00Z") }, // different asset
      { assetId: "A1", failureCode: "FC2", occurredAt: new Date("2026-09-14T00:00:00Z") }  // different code
    ];
    expect(computeRepeatFailures(events, 30, now)).toBe(1);
  });

  it("excludes events outside the lookback window", () => {
    const events = [
      { assetId: "A1", failureCode: "FC1", occurredAt: new Date("2026-08-01T00:00:00Z") }, // >30d ago
      { assetId: "A1", failureCode: "FC1", occurredAt: new Date("2026-08-02T00:00:00Z") }  // >30d ago
    ];
    expect(computeRepeatFailures(events, 30, now)).toBe(0);
  });

  it("returns 0 for no events", () => {
    expect(computeRepeatFailures([], 30, now)).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 13. computeMaintenanceCost
// ──────────────────────────────────────────────────────────────────────────────

describe("computeMaintenanceCost", () => {
  it("sums snapshot totals: 100+250+150 = 500", () => {
    expect(computeMaintenanceCost([100, 250, 150])).toBe(500);
  });

  it("returns 0 for empty snapshots", () => {
    expect(computeMaintenanceCost([])).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 14. computeCostPerKm — fixture
// ──────────────────────────────────────────────────────────────────────────────

describe("computeCostPerKm", () => {
  it("1000 cost / 200 km = 5", () => {
    expect(computeCostPerKm(1000, 200)).toBe(5);
  });

  it("returns null when distance = 0 (not 0 cost/km)", () => {
    expect(computeCostPerKm(1000, 0)).toBeNull();
  });

  it("returns null when distance is negative", () => {
    expect(computeCostPerKm(1000, -100)).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 15. Fleet service compliance
// ──────────────────────────────────────────────────────────────────────────────

describe("computeFleetServiceCompliance", () => {
  it("8 on-time / 10 due = 80%", () => {
    expect(computeFleetServiceCompliance(8, 10)).toBeCloseTo(80);
  });

  it("returns null when due = 0", () => {
    expect(computeFleetServiceCompliance(0, 0)).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 16. Building backlog / Compliance rate
// ──────────────────────────────────────────────────────────────────────────────

describe("computeComplianceRate", () => {
  it("9 valid / 10 total = 90%", () => {
    expect(computeComplianceRate(9, 10)).toBeCloseTo(90);
  });

  it("returns null when totalCount = 0", () => {
    expect(computeComplianceRate(0, 0)).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 17. Backlog aging buckets
// ──────────────────────────────────────────────────────────────────────────────

describe("computeBacklogAging", () => {
  const now = new Date("2026-09-15T00:00:00Z");

  it("correctly buckets by age", () => {
    const wos = [
      { status: "OPEN",        createdAt: new Date("2026-09-13T00:00:00Z") }, // 2d → lt7d
      { status: "IN_PROGRESS", createdAt: new Date("2026-09-05T00:00:00Z") }, // 10d → d7to30
      { status: "ON_HOLD",     createdAt: new Date("2026-07-10T00:00:00Z") }, // ~67d → d30to90
      { status: "OPEN",        createdAt: new Date("2026-05-01T00:00:00Z") }, // ~137d → gt90d
      { status: "CLOSED",      createdAt: new Date("2026-09-10T00:00:00Z") }  // terminal, excluded
    ];
    const result = computeBacklogAging(wos, now);
    expect(result.lt7d).toBe(1);
    expect(result.d7to30).toBe(1);
    expect(result.d30to90).toBe(1);
    expect(result.gt90d).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 18. isKpiApplicableForDomain
// ──────────────────────────────────────────────────────────────────────────────

describe("isKpiApplicableForDomain", () => {
  it("MTBF is applicable for PLANT_MACHINERY", () => {
    expect(isKpiApplicableForDomain("MTBF", "PLANT_MACHINERY")).toBe(true);
  });

  it("MTBF is NOT applicable for FACILITY_CIVIL", () => {
    expect(isKpiApplicableForDomain("MTBF", "FACILITY_CIVIL")).toBe(false);
  });

  it("WO_OVERDUE (applicableDomains=[*]) applies to any domain", () => {
    expect(isKpiApplicableForDomain("WO_OVERDUE", "FACILITY_CIVIL")).toBe(true);
    expect(isKpiApplicableForDomain("WO_OVERDUE", "FLEET_VEHICLE")).toBe(true);
  });

  it("COST_PER_KM is applicable for FLEET_VEHICLE", () => {
    expect(isKpiApplicableForDomain("COST_PER_KM", "FLEET_VEHICLE")).toBe(true);
  });

  it("COST_PER_KM is NOT applicable for PLANT_MACHINERY", () => {
    expect(isKpiApplicableForDomain("COST_PER_KM", "PLANT_MACHINERY")).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 19. Domain-profiles isKpiApplicable cross-check
// ──────────────────────────────────────────────────────────────────────────────

describe("domain-profiles isKpiApplicable", () => {
  it("PLANT_MACHINERY has MTBF in kpiKeys", () => {
    expect(isKpiApplicable("PLANT_MACHINERY", "MTBF")).toBe(true);
  });

  it("FACILITY_CIVIL does NOT have MTBF in kpiKeys", () => {
    expect(isKpiApplicable("FACILITY_CIVIL", "MTBF")).toBe(false);
  });

  it("MECHANICAL has MTTR in kpiKeys", () => {
    expect(isKpiApplicable("MECHANICAL", "MTTR")).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 20. Role home profiles
// ──────────────────────────────────────────────────────────────────────────────

describe("ROLE_HOME_PROFILES", () => {
  it("contains all required profile keys", () => {
    const keys = ROLE_HOME_PROFILES.map((p) => p.roleKey);
    expect(keys).toContain("REQUESTER");
    expect(keys).toContain("TECHNICIAN");
    expect(keys).toContain("SUPERVISOR");
    expect(keys).toContain("FLEET");
    expect(keys).toContain("MANAGER");
    expect(keys).toContain("MANAGEMENT_VIEWER");
  });

  it("TECHNICIAN profile has my-jobs card", () => {
    const profile = ROLE_HOME_PROFILES.find((p) => p.roleKey === "TECHNICIAN");
    expect(profile!.cards.map((c) => c.id)).toContain("my-jobs");
  });

  it("SUPERVISOR profile has pm-due card", () => {
    const profile = ROLE_HOME_PROFILES.find((p) => p.roleKey === "SUPERVISOR");
    expect(profile!.cards.map((c) => c.id)).toContain("pm-due");
  });

  it("FLEET profile has doc-expiry card linking to /compliance", () => {
    const profile = ROLE_HOME_PROFILES.find((p) => p.roleKey === "FLEET");
    const docExpiry = profile!.cards.find((c) => c.id === "doc-expiry");
    expect(docExpiry).toBeDefined();
    expect(docExpiry!.href).toBe("/compliance");
  });

  it("MANAGER profile has kpiCodes on report cards", () => {
    const profile = ROLE_HOME_PROFILES.find((p) => p.roleKey === "MANAGER");
    const kpiCard = profile!.cards.find((c) => c.kpiCodes && c.kpiCodes.length > 0);
    expect(kpiCard).toBeDefined();
  });

  it("MANAGEMENT_VIEWER profile is read-only (links to /reports)", () => {
    const profile = ROLE_HOME_PROFILES.find((p) => p.roleKey === "MANAGEMENT_VIEWER");
    const reportCard = profile!.cards.find((c) => c.href.startsWith("/reports"));
    expect(reportCard).toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 21. resolveRoleHome — role mapping
// ──────────────────────────────────────────────────────────────────────────────

describe("resolveRoleHome", () => {
  it("TECHNICIAN → TECHNICIAN profile", () => {
    expect(resolveRoleHome("TECHNICIAN").roleKey).toBe("TECHNICIAN");
  });

  it("MECHANIC → TECHNICIAN profile", () => {
    expect(resolveRoleHome("MECHANIC").roleKey).toBe("TECHNICIAN");
  });

  it("SUPERVISOR → SUPERVISOR profile", () => {
    expect(resolveRoleHome("SUPERVISOR").roleKey).toBe("SUPERVISOR");
  });

  it("MAINTENANCE_SUPERVISOR → SUPERVISOR profile", () => {
    expect(resolveRoleHome("MAINTENANCE_SUPERVISOR").roleKey).toBe("SUPERVISOR");
  });

  it("FLEET_MANAGER → FLEET profile", () => {
    expect(resolveRoleHome("FLEET_MANAGER").roleKey).toBe("FLEET");
  });

  it("DRIVER → FLEET profile", () => {
    expect(resolveRoleHome("DRIVER").roleKey).toBe("FLEET");
  });

  it("SECURITY_OFFICER → FLEET profile", () => {
    expect(resolveRoleHome("SECURITY_OFFICER").roleKey).toBe("FLEET");
  });

  it("MANAGER → MANAGER profile", () => {
    expect(resolveRoleHome("MANAGER").roleKey).toBe("MANAGER");
  });

  it("OPERATIONS_MANAGER → MANAGER profile", () => {
    expect(resolveRoleHome("OPERATIONS_MANAGER").roleKey).toBe("MANAGER");
  });

  it("ADMIN → MANAGER profile (broadest operational view)", () => {
    expect(resolveRoleHome("ADMIN").roleKey).toBe("MANAGER");
  });

  it("SUPER_ADMIN → MANAGER profile", () => {
    expect(resolveRoleHome("SUPER_ADMIN").roleKey).toBe("MANAGER");
  });

  it("VIEWER → MANAGEMENT_VIEWER profile", () => {
    expect(resolveRoleHome("VIEWER").roleKey).toBe("MANAGEMENT_VIEWER");
  });

  it("AUDITOR → MANAGEMENT_VIEWER profile", () => {
    expect(resolveRoleHome("AUDITOR").roleKey).toBe("MANAGEMENT_VIEWER");
  });

  it("FINANCE → MANAGEMENT_VIEWER profile", () => {
    expect(resolveRoleHome("FINANCE").roleKey).toBe("MANAGEMENT_VIEWER");
  });

  it("REQUESTER → REQUESTER profile", () => {
    expect(resolveRoleHome("REQUESTER").roleKey).toBe("REQUESTER");
  });

  it("unknown role → REQUESTER profile", () => {
    expect(resolveRoleHome("UNKNOWN_ROLE_XYZ").roleKey).toBe("REQUESTER");
  });

  it("null → REQUESTER profile", () => {
    expect(resolveRoleHome(null).roleKey).toBe("REQUESTER");
  });

  it("case-insensitive resolution", () => {
    expect(resolveRoleHome("technician").roleKey).toBe("TECHNICIAN");
    expect(resolveRoleHome("admin").roleKey).toBe("MANAGER");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 22. RBAC / Permission catalog
// ──────────────────────────────────────────────────────────────────────────────

describe("RBAC permission catalog", () => {
  it("contains Phase 13 report-domain permission keys", () => {
    expect(PERMISSION_CATALOG).toContain("reports.view.maintenance");
    expect(PERMISSION_CATALOG).toContain("reports.view.cost");
    expect(PERMISSION_CATALOG).toContain("reports.view.fleet");
    expect(PERMISSION_CATALOG).toContain("reports.view.compliance");
  });

  it("retains existing reports.view and reports.management.view", () => {
    expect(PERMISSION_CATALOG).toContain("reports.view");
    expect(PERMISSION_CATALOG).toContain("reports.management.view");
    expect(PERMISSION_CATALOG).toContain("reports.export");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 23. Navigation — shared Home is /action-center
// ──────────────────────────────────────────────────────────────────────────────

describe("Navigation shared home", () => {
  it("Home nav item href is /action-center (single Home entry)", () => {
    const homeItem = NAVIGATION_ITEMS.find((item) => item.id === "home");
    expect(homeItem).toBeDefined();
    expect(homeItem!.href).toBe("/action-center");
    expect(homeItem!.label).toBe("Action Center");
  });

  it("there is exactly one primary nav item with id=home", () => {
    const homeItems = NAVIGATION_ITEMS.filter((item) => item.id === "home");
    expect(homeItems).toHaveLength(1);
  });

  it("no competing Dashboard or Workspace primary nav items exist", () => {
    const competing = NAVIGATION_ITEMS.filter(
      (item) =>
        item.category === "primary" &&
        (item.id === "dashboard" || item.id === "workspace" || item.id === "action-center-menu")
    );
    expect(competing).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 24. KPI payloads — secrets not present
// ──────────────────────────────────────────────────────────────────────────────

describe("KPI payload security", () => {
  it("KPI definitions do not expose database field values, secrets, or connection strings", () => {
    const serialized = JSON.stringify(KPI_DEFINITIONS);
    expect(serialized).not.toContain("mongodb://");
    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("jwt");
    expect(serialized).not.toContain("DATABASE_URL");
  });
});
