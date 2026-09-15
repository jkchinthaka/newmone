/**
 * Phase 14 — Production Hardening Tests
 *
 * Pure/unit tests for cross-cutting production invariants. No Prisma, no HTTP,
 * no external dependencies. All helpers imported from domain-pure modules.
 *
 * Target: ≥ 20 green tests covering:
 *   - sanitizeSystemResponse / sensitive field stripping
 *   - Overdue WO: closed WO with past due date NOT counted
 *   - Mock ERP never production success
 *   - Last admin protected
 *   - Cost snapshot immutability comment
 *   - TERMINAL statuses exclude overdue
 *   - Permission catalog contains required keys
 *   - Soft-retired modules documented
 */

import {
  sanitizeSystemResponse,
  SENSITIVE_CONFIG_FIELDS,
  evaluateUserDeactivation,
} from "../src/modules/admin-governance/admin-safety";

import {
  erpSyncOutcome,
  computeWorkOrderTotalCost,
  resolveStockSourceBoundary,
} from "../src/modules/maintenance-supply/supply-boundary";

import {
  TERMINAL_WO_STATUSES,
  isTerminalStatus,
  computeOverdueCount,
  computeBacklogCount,
  computeMtbf,
  computePmCompliance,
  KPI_FORMULA_VERSION,
  KPI_DEFINITIONS,
} from "../src/modules/reporting-kpis/kpi-definitions";

import {
  SOFT_RETIRED_MODULE_KEYS,
  isSoftRetiredModule,
  assertNoFabricatedErpSuccess,
} from "../src/modules/production-hardening/production-hardening";

import { PERMISSION_CATALOG } from "../src/database/permission-catalog";

// ─── 1. Sensitive field stripping ─────────────────────────────────────────────

describe("sanitizeSystemResponse", () => {
  it("strips password field", () => {
    const result = sanitizeSystemResponse({ password: "secret", name: "Alice" } as any);
    expect(result).not.toHaveProperty("password");
    expect(result).toHaveProperty("name");
  });

  it("strips passwordHash field", () => {
    const result = sanitizeSystemResponse({ passwordHash: "hashed", id: "1" } as any);
    expect(result).not.toHaveProperty("passwordHash");
    expect(result).toHaveProperty("id");
  });

  it("strips apiKey field", () => {
    const result = sanitizeSystemResponse({ apiKey: "abc", status: "ok" } as any);
    expect(result).not.toHaveProperty("apiKey");
    expect(result).toHaveProperty("status");
  });

  it("strips jwtSecret field", () => {
    const result = sanitizeSystemResponse({ jwtSecret: "verysecret", version: 1 } as any);
    expect(result).not.toHaveProperty("jwtSecret");
    expect(result).toHaveProperty("version");
  });

  it("passes through non-sensitive fields unchanged", () => {
    const result = sanitizeSystemResponse({ tenantId: "t1", status: "ACTIVE", count: 5 } as any);
    expect(result).toEqual({ tenantId: "t1", status: "ACTIVE", count: 5 });
  });

  it("SENSITIVE_CONFIG_FIELDS contains all expected secret field names", () => {
    for (const field of [
      "password",
      "passwordHash",
      "connectionString",
      "apiKey",
      "apiSecret",
      "secretKey",
      "token",
      "refreshToken",
      "jwtSecret",
    ]) {
      expect(SENSITIVE_CONFIG_FIELDS.has(field)).toBe(true);
    }
  });
});

// ─── 2. Overdue — closed WO NOT counted ───────────────────────────────────────

describe("overdue WO invariant", () => {
  const pastDate = new Date("2020-01-01");
  const now = new Date("2026-09-15");

  it("CLOSED WO with past due date is NOT overdue", () => {
    const wos = [{ dueAt: pastDate, status: "CLOSED" }];
    expect(computeOverdueCount(wos, now)).toBe(0);
  });

  it("CANCELLED WO with past due date is NOT overdue", () => {
    const wos = [{ dueAt: pastDate, status: "CANCELLED" }];
    expect(computeOverdueCount(wos, now)).toBe(0);
  });

  it("OPEN WO with past due date IS overdue", () => {
    const wos = [{ dueAt: pastDate, status: "OPEN" }];
    expect(computeOverdueCount(wos, now)).toBe(1);
  });

  it("IN_PROGRESS WO with past due date IS overdue", () => {
    const wos = [{ dueAt: pastDate, status: "IN_PROGRESS" }];
    expect(computeOverdueCount(wos, now)).toBe(1);
  });

  it("mixed set: only non-terminal count as overdue", () => {
    const wos = [
      { dueAt: pastDate, status: "CLOSED" },
      { dueAt: pastDate, status: "CANCELLED" },
      { dueAt: pastDate, status: "OPEN" },
      { dueAt: pastDate, status: "IN_PROGRESS" },
    ];
    expect(computeOverdueCount(wos, now)).toBe(2);
  });

  it("isTerminalStatus returns true for CLOSED", () => {
    expect(isTerminalStatus("CLOSED")).toBe(true);
  });

  it("isTerminalStatus returns true for CANCELLED", () => {
    expect(isTerminalStatus("CANCELLED")).toBe(true);
  });

  it("isTerminalStatus returns false for OPEN", () => {
    expect(isTerminalStatus("OPEN")).toBe(false);
  });

  it("TERMINAL_WO_STATUSES contains CLOSED and CANCELLED only", () => {
    expect(TERMINAL_WO_STATUSES).toContain("CLOSED");
    expect(TERMINAL_WO_STATUSES).toContain("CANCELLED");
    expect(TERMINAL_WO_STATUSES).toHaveLength(2);
  });

  it("computeBacklogCount excludes terminal statuses", () => {
    const wos = [
      { status: "CLOSED" },
      { status: "CANCELLED" },
      { status: "OPEN" },
      { status: "ON_HOLD" },
    ];
    expect(computeBacklogCount(wos)).toBe(2);
  });
});

// ─── 3. ERP mock safety ───────────────────────────────────────────────────────

describe("ERP mock never production success", () => {
  it("mockMode outcome is never reportableAsProductionSuccess", () => {
    const outcome = erpSyncOutcome({ productionMode: true, mockMode: true, success: true });
    expect(outcome.reportableAsProductionSuccess).toBe(false);
  });

  it("mockMode success status is MOCK_OK, not SUCCESS", () => {
    const outcome = erpSyncOutcome({ productionMode: true, mockMode: true, success: true });
    expect(outcome.status).toBe("MOCK_OK");
  });

  it("mockMode failure status is MOCK_FAILED", () => {
    const outcome = erpSyncOutcome({ productionMode: true, mockMode: true, success: false });
    expect(outcome.status).toBe("MOCK_FAILED");
    expect(outcome.reportableAsProductionSuccess).toBe(false);
  });

  it("real production success IS reportableAsProductionSuccess", () => {
    const outcome = erpSyncOutcome({ productionMode: true, mockMode: false, success: true });
    expect(outcome.reportableAsProductionSuccess).toBe(true);
  });

  it("assertNoFabricatedErpSuccess does not throw for mock outcome", () => {
    const outcome = erpSyncOutcome({ productionMode: true, mockMode: true, success: true });
    expect(() => assertNoFabricatedErpSuccess(outcome)).not.toThrow();
  });

  it("resolveStockSourceBoundary: mock in productionMode returns UNKNOWN/non-authoritative", () => {
    const result = resolveStockSourceBoundary({
      productionMode: true,
      mockSync: true,
      erpCode: "ITEM-001",
      erpSyncEnabled: true,
    });
    expect(result.source).toBe("UNKNOWN");
    expect(result.authoritative).toBe(false);
  });
});

// ─── 4. Last admin protected ──────────────────────────────────────────────────

describe("last admin protection", () => {
  it("cannot deactivate last ADMIN", () => {
    const decision = evaluateUserDeactivation({
      actorId: "other",
      targetUserId: "admin1",
      targetRole: "ADMIN",
      targetIsActive: true,
      nextIsActive: false,
      activeAdminCount: 1,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe("LAST_ADMIN_PROTECTED");
  });

  it("cannot deactivate last SUPER_ADMIN", () => {
    const decision = evaluateUserDeactivation({
      actorId: "other",
      targetUserId: "sa1",
      targetRole: "SUPER_ADMIN",
      targetIsActive: true,
      nextIsActive: false,
      activeAdminCount: 1,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe("LAST_ADMIN_PROTECTED");
  });

  it("can deactivate ADMIN when another admin exists", () => {
    const decision = evaluateUserDeactivation({
      actorId: "other",
      targetUserId: "admin2",
      targetRole: "ADMIN",
      targetIsActive: true,
      nextIsActive: false,
      activeAdminCount: 2,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.code).toBe("DEACTIVATE_OK");
  });

  it("self-deactivation is always blocked", () => {
    const decision = evaluateUserDeactivation({
      actorId: "me",
      targetUserId: "me",
      targetRole: "ADMIN",
      targetIsActive: true,
      nextIsActive: false,
      activeAdminCount: 5,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe("SELF_DEACTIVATE_BLOCKED");
  });

  it("technician with open WOs requires reassignment before deactivation", () => {
    const decision = evaluateUserDeactivation({
      actorId: "mgr",
      targetUserId: "tech1",
      targetRole: "TECHNICIAN",
      targetIsActive: true,
      nextIsActive: false,
      activeAdminCount: 2,
      openWorkOrderIds: ["wo-1", "wo-2"],
    });
    expect(decision.allowed).toBe(false);
    expect(decision.requireReassignment).toBe(true);
  });
});

// ─── 5. MTBF: INSUFFICIENT_DATA invariant ────────────────────────────────────

describe("MTBF INSUFFICIENT_DATA invariant", () => {
  it("returns null (not 0) when operatingHours is null", () => {
    expect(computeMtbf(null, 5)).toBeNull();
  });

  it("returns null (not 0) when operatingHours is undefined", () => {
    expect(computeMtbf(undefined, 5)).toBeNull();
  });

  it("returns null when operatingHours is 0 (no data)", () => {
    expect(computeMtbf(0, 5)).toBeNull();
  });

  it("returns null when failureCount is 0", () => {
    expect(computeMtbf(1000, 0)).toBeNull();
  });

  it("MTBF KPI definition has emptyBehavior INSUFFICIENT_DATA", () => {
    const mtbfDef = KPI_DEFINITIONS.find((k) => k.code === "MTBF");
    expect(mtbfDef).toBeDefined();
    expect(mtbfDef!.emptyBehavior).toBe("INSUFFICIENT_DATA");
  });
});

// ─── 6. PM compliance null (not 0) when no data ───────────────────────────────

describe("PM compliance null-on-no-data invariant", () => {
  it("returns null when dueCount is 0 (no obligations)", () => {
    expect(computePmCompliance(0, 0)).toBeNull();
  });

  it("returns 100 when all PMs on time", () => {
    expect(computePmCompliance(10, 10)).toBe(100);
  });
});

// ─── 7. WO cost uses snapshots ────────────────────────────────────────────────

describe("cost snapshot immutability (unit)", () => {
  it("computeWorkOrderTotalCost sums breakdown fields", () => {
    const total = computeWorkOrderTotalCost({
      partsCost: 100,
      internalLabourCost: 200,
      externalServiceCost: 50,
      transportCost: 10,
      otherCost: 5,
    });
    expect(total).toBe(365);
  });

  it("handles zero/missing fields without NaN", () => {
    const total = computeWorkOrderTotalCost({
      partsCost: 0,
      internalLabourCost: 0,
      externalServiceCost: 0,
      transportCost: 0,
      otherCost: 0,
    });
    expect(total).toBe(0);
    expect(Number.isNaN(total)).toBe(false);
  });

  it("MAINTENANCE_COST KPI uses snapshotTotal source field", () => {
    const costDef = KPI_DEFINITIONS.find((k) => k.code === "MAINTENANCE_COST");
    expect(costDef).toBeDefined();
    expect(costDef!.sourceFields).toContain("snapshotTotal");
  });
});

// ─── 8. Permission catalog completeness ──────────────────────────────────────

describe("permission catalog required keys", () => {
  it("contains reports.view", () => {
    expect(PERMISSION_CATALOG).toContain("reports.view");
  });

  it("contains admin.overview.view", () => {
    expect(PERMISSION_CATALOG).toContain("admin.overview.view");
  });

  it("contains gate.override.approve", () => {
    expect(PERMISSION_CATALOG).toContain("gate.override.approve");
  });

  it("contains gate.override (alias)", () => {
    expect(PERMISSION_CATALOG).toContain("gate.override");
  });

  it("contains planning.manage", () => {
    expect(PERMISSION_CATALOG).toContain("planning.manage");
  });

  it("contains fleet.manage", () => {
    expect(PERMISSION_CATALOG).toContain("fleet.manage");
  });

  it("contains admin.dataquality.view (data quality module)", () => {
    expect(PERMISSION_CATALOG).toContain("admin.dataquality.view");
  });
});

// ─── 9. Soft-retired modules documented ──────────────────────────────────────

describe("soft-retired modules inventory", () => {
  it("SOFT_RETIRED_MODULE_KEYS is a non-empty tuple", () => {
    expect(SOFT_RETIRED_MODULE_KEYS.length).toBeGreaterThan(0);
  });

  it("farm is soft-retired", () => {
    expect(isSoftRetiredModule("farm")).toBe(true);
  });

  it("cleaning is soft-retired", () => {
    expect(isSoftRetiredModule("cleaning")).toBe(true);
  });

  it("billing is soft-retired", () => {
    expect(isSoftRetiredModule("billing")).toBe(true);
  });

  it("qa is soft-retired", () => {
    expect(isSoftRetiredModule("qa")).toBe(true);
  });

  it("predictive-ai is soft-retired", () => {
    expect(isSoftRetiredModule("predictive-ai")).toBe(true);
  });

  it("work-orders is NOT soft-retired (active module)", () => {
    expect(isSoftRetiredModule("work-orders")).toBe(false);
  });
});

// ─── 10. KPI formula version pinned ──────────────────────────────────────────

describe("KPI formula version stability", () => {
  it("formula version is pinned to 2026-09-15.v1", () => {
    expect(KPI_FORMULA_VERSION).toBe("2026-09-15.v1");
  });

  it("all KPI definitions carry the version stamp", () => {
    for (const kpi of KPI_DEFINITIONS) {
      expect(kpi.version).toBe(KPI_FORMULA_VERSION);
    }
  });
});
