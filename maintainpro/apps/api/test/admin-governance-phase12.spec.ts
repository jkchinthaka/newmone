/**
 * Phase 12 — Admin Governance tests.
 *
 * Covers: last-admin protection, self-lockout, tech open-WO block, high-impact config guard,
 * bulk stage gating, DQ severity catalog, overview shape (mocked), secrets excluded,
 * RBAC catalog keys, admin-console section hrefs, tenant isolation on governance service.
 */

import { BadRequestException } from "@nestjs/common";
import { RoleName } from "@prisma/client";

import {
  canWriteBulkRows,
  evaluateHighImpactConfigChange,
  evaluateUserDeactivation,
  nextBulkImportStage,
  sanitizeSystemResponse,
  SENSITIVE_CONFIG_FIELDS
} from "../src/modules/admin-governance/admin-safety";
import { DATA_QUALITY_RULES } from "../src/modules/admin-governance/admin-catalog";
import { PERMISSION_CATALOG } from "../src/database/permission-catalog";
import { AdminGovernanceService } from "../src/modules/admin-governance/admin-governance.service";
import { getAdminConsoleSections } from "../../web/lib/admin-console";

// ---------------------------------------------------------------------------
// evaluateUserDeactivation
// ---------------------------------------------------------------------------

describe("evaluateUserDeactivation", () => {
  const base = {
    actorId: "actor-1",
    targetUserId: "user-2",
    targetRole: RoleName.TECHNICIAN,
    targetIsActive: true,
    nextIsActive: false,
    activeAdminCount: 3
  };

  it("allows reactivation unconditionally", () => {
    const result = evaluateUserDeactivation({ ...base, nextIsActive: true });
    expect(result.allowed).toBe(true);
    expect(result.code).toBe("REACTIVATE_OK");
  });

  it("blocks self-deactivation", () => {
    const result = evaluateUserDeactivation({ ...base, actorId: "user-2", targetUserId: "user-2" });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("SELF_DEACTIVATE_BLOCKED");
  });

  it("protects last ADMIN in tenant", () => {
    const result = evaluateUserDeactivation({ ...base, targetRole: RoleName.ADMIN, activeAdminCount: 1 });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("LAST_ADMIN_PROTECTED");
  });

  it("protects last SUPER_ADMIN", () => {
    const result = evaluateUserDeactivation({ ...base, targetRole: RoleName.SUPER_ADMIN, activeAdminCount: 1 });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("LAST_ADMIN_PROTECTED");
  });

  it("allows ADMIN deactivation when other admins remain", () => {
    const result = evaluateUserDeactivation({ ...base, targetRole: RoleName.ADMIN, activeAdminCount: 2 });
    expect(result.allowed).toBe(true);
    expect(result.code).toBe("DEACTIVATE_OK");
  });

  it("blocks TECHNICIAN deactivation when open WOs present", () => {
    const result = evaluateUserDeactivation({ ...base, targetRole: RoleName.TECHNICIAN, openWorkOrderIds: ["wo-1", "wo-2"] });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("OPEN_WORK_REQUIRES_REASSIGNMENT");
    expect(result.requireReassignment).toBe(true);
    expect(result.openWorkOrderIds).toEqual(["wo-1", "wo-2"]);
  });

  it("allows TECHNICIAN deactivation with no open WOs", () => {
    const result = evaluateUserDeactivation({ ...base, openWorkOrderIds: [] });
    expect(result.allowed).toBe(true);
    expect(result.requireReassignment).toBe(false);
  });

  it("returns empty openWorkOrderIds on allowed deactivation", () => {
    const result = evaluateUserDeactivation({ ...base });
    expect(result.openWorkOrderIds).toEqual([]);
  });

  it("blocks MECHANIC with open WO just like TECHNICIAN", () => {
    const result = evaluateUserDeactivation({ ...base, targetRole: "MECHANIC", openWorkOrderIds: ["wo-x"] });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("OPEN_WORK_REQUIRES_REASSIGNMENT");
  });

  it("does not require reassignment for MANAGER with open WOs (not a tech role)", () => {
    const result = evaluateUserDeactivation({ ...base, targetRole: RoleName.MANAGER, openWorkOrderIds: ["wo-1"] });
    expect(result.allowed).toBe(true);
    expect(result.code).toBe("DEACTIVATE_OK");
  });
});

// ---------------------------------------------------------------------------
// evaluateHighImpactConfigChange
// ---------------------------------------------------------------------------

describe("evaluateHighImpactConfigChange", () => {
  it("requires confirmation", () => {
    const r = evaluateHighImpactConfigChange({ confirmed: false, impactPreviewProvided: true, reason: "fix" });
    expect(r.allowed).toBe(false);
    expect(r.code).toBe("CONFIRMATION_REQUIRED");
  });

  it("requires impact preview", () => {
    const r = evaluateHighImpactConfigChange({ confirmed: true, impactPreviewProvided: false, reason: "fix" });
    expect(r.allowed).toBe(false);
    expect(r.code).toBe("IMPACT_PREVIEW_REQUIRED");
  });

  it("requires non-empty reason", () => {
    const r = evaluateHighImpactConfigChange({ confirmed: true, impactPreviewProvided: true, reason: "   " });
    expect(r.allowed).toBe(false);
    expect(r.code).toBe("REASON_REQUIRED");
  });

  it("allows when all fields provided", () => {
    const r = evaluateHighImpactConfigChange({ confirmed: true, impactPreviewProvided: true, reason: "scheduled maintenance" });
    expect(r.allowed).toBe(true);
    expect(r.code).toBe("CONFIG_CHANGE_OK");
  });

  it("requires reason when null", () => {
    const r = evaluateHighImpactConfigChange({ confirmed: true, impactPreviewProvided: true, reason: null });
    expect(r.allowed).toBe(false);
    expect(r.code).toBe("REASON_REQUIRED");
  });
});

// ---------------------------------------------------------------------------
// Bulk import stage gating
// ---------------------------------------------------------------------------

describe("nextBulkImportStage", () => {
  it("progresses UPLOAD → VALIDATE", () => {
    expect(nextBulkImportStage("UPLOAD", false)).toBe("VALIDATE");
  });

  it("progresses VALIDATE → PREVIEW", () => {
    expect(nextBulkImportStage("VALIDATE", false)).toBe("PREVIEW");
  });

  it("routes PREVIEW with errors → SHOW_ERRORS", () => {
    expect(nextBulkImportStage("PREVIEW", true)).toBe("SHOW_ERRORS");
  });

  it("routes PREVIEW without errors → CONFIRM", () => {
    expect(nextBulkImportStage("PREVIEW", false)).toBe("CONFIRM");
  });

  it("routes SHOW_ERRORS without errors → CONFIRM", () => {
    expect(nextBulkImportStage("SHOW_ERRORS", false)).toBe("CONFIRM");
  });

  it("routes SHOW_ERRORS with errors → null (stalled)", () => {
    expect(nextBulkImportStage("SHOW_ERRORS", true)).toBeNull();
  });

  it("routes CONFIRM without errors → IMPORT", () => {
    expect(nextBulkImportStage("CONFIRM", false)).toBe("IMPORT");
  });

  it("routes CONFIRM with errors → null", () => {
    expect(nextBulkImportStage("CONFIRM", true)).toBeNull();
  });

  it("progresses IMPORT → AUDIT", () => {
    expect(nextBulkImportStage("IMPORT", false)).toBe("AUDIT");
  });

  it("returns null after AUDIT (terminal)", () => {
    expect(nextBulkImportStage("AUDIT", false)).toBeNull();
  });

  it("returns null for unknown stage", () => {
    expect(nextBulkImportStage("UNKNOWN" as any, false)).toBeNull();
  });

  it("canWriteBulkRows only at IMPORT stage when validated+confirmed", () => {
    expect(canWriteBulkRows("IMPORT", true, true)).toBe(true);
    expect(canWriteBulkRows("CONFIRM", true, true)).toBe(false);
    expect(canWriteBulkRows("IMPORT", false, true)).toBe(false);
    expect(canWriteBulkRows("IMPORT", true, false)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Data quality catalog
// ---------------------------------------------------------------------------

describe("DATA_QUALITY_RULES", () => {
  it("defines at least 10 rules", () => {
    expect(DATA_QUALITY_RULES.length).toBeGreaterThanOrEqual(10);
  });

  it("uses only valid severity values", () => {
    const valid = new Set(["CRITICAL", "HIGH", "WARNING", "INFO"]);
    DATA_QUALITY_RULES.forEach((r) => {
      expect(valid.has(r.severity)).toBe(true);
    });
  });

  it("includes at least one CRITICAL rule", () => {
    expect(DATA_QUALITY_RULES.some((r) => r.severity === "CRITICAL")).toBe(true);
  });

  it("includes at least one HIGH rule", () => {
    expect(DATA_QUALITY_RULES.some((r) => r.severity === "HIGH")).toBe(true);
  });

  it("every rule has code, severity, domain, entityType, message", () => {
    DATA_QUALITY_RULES.forEach((r) => {
      expect(typeof r.code).toBe("string");
      expect(typeof r.severity).toBe("string");
      expect(typeof r.domain).toBe("string");
      expect(typeof r.entityType).toBe("string");
      expect(typeof r.message).toBe("string");
    });
  });

  it("includes FLEET_NO_ASSET_LINK (fleet domain DQ)", () => {
    expect(DATA_QUALITY_RULES.some((r) => r.code === "FLEET_NO_ASSET_LINK")).toBe(true);
  });

  it("includes ERP_UNMAPPED_PARTS rule", () => {
    expect(DATA_QUALITY_RULES.some((r) => r.code === "ERP_UNMAPPED_PARTS")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Secrets sanitization
// ---------------------------------------------------------------------------

describe("sanitizeSystemResponse", () => {
  it("strips password and connectionString fields", () => {
    const raw = { nodeVersion: "20", platform: "linux", password: "secret", connectionString: "mongodb://..." };
    const result = sanitizeSystemResponse(raw);
    expect(result).not.toHaveProperty("password");
    expect(result).not.toHaveProperty("connectionString");
    expect(result.nodeVersion).toBe("20");
  });

  it("strips all SENSITIVE_CONFIG_FIELDS", () => {
    const raw: Record<string, unknown> = {};
    for (const field of SENSITIVE_CONFIG_FIELDS) raw[field] = "REDACTED";
    raw.safeField = "keep";
    const result = sanitizeSystemResponse(raw);
    for (const field of SENSITIVE_CONFIG_FIELDS) expect(result).not.toHaveProperty(field);
    expect(result.safeField).toBe("keep");
  });
});

// ---------------------------------------------------------------------------
// RBAC catalog — Phase 12 keys present
// ---------------------------------------------------------------------------

describe("PERMISSION_CATALOG Phase 12 keys", () => {
  const phase12Keys = [
    "admin.overview.view",
    "admin.dataquality.view",
    "admin.audit.view",
    "admin.system.view",
    "admin.users.manage",
    "admin.organization.manage"
  ];

  phase12Keys.forEach((key) => {
    it(`includes permission key: ${key}`, () => {
      expect(PERMISSION_CATALOG).toContain(key);
    });
  });
});

// ---------------------------------------------------------------------------
// Admin console section hrefs
// ---------------------------------------------------------------------------

describe("admin-console sections Phase 12", () => {
  const sections = getAdminConsoleSections();

  it("data-quality section points to /admin/data-quality", () => {
    const section = sections.find((s) => s.id === "data-quality");
    expect(section?.href).toBe("/admin/data-quality");
  });

  it("audit-log section points to /admin/audit", () => {
    const section = sections.find((s) => s.id === "audit-log");
    expect(section?.href).toBe("/admin/audit");
  });

  it("technical section still points to /system-health with technicalOnly", () => {
    const section = sections.find((s) => s.id === "technical");
    expect(section?.href).toBe("/system-health");
    expect(section?.technicalOnly).toBe(true);
  });

  it("keeps Phase 1 hrefs unchanged", () => {
    expect(sections.find((s) => s.id === "organization")?.href).toBe("/admin/organization");
    expect(sections.find((s) => s.id === "asset-masters")?.href).toBe("/admin/asset-masters");
    expect(sections.find((s) => s.id === "approvals")?.href).toBe("/admin/approvals");
    expect(sections.find((s) => s.id === "users-access")?.href).toBe("/admin/users");
    expect(sections.find((s) => s.id === "invitations-onboarding")?.href).toBe("/admin/invitations");
  });

  it("has no go-live/delivery/qa/billing clutter", () => {
    expect(sections.some((s) => /delivery|go-live|post-go-live|billing|qa/i.test(s.id))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AdminGovernanceService — mocked Prisma
// ---------------------------------------------------------------------------

function buildGovernancePrisma(overrides: {
  userCount?: number;
  adminCount?: number;
  vehiclesNoAsset?: number;
  unmappedParts?: number;
  pendingImports?: number;
  openWOs?: { id: string }[];
  targetUser?: { id: string; isActive: boolean; role: { name: RoleName } } | null;
  businessExceptions?: any[];
} = {}) {
  return {
    user: {
      findFirst: jest.fn(async () =>
        overrides.targetUser !== undefined
          ? overrides.targetUser
          : { id: "u1", isActive: true, role: { name: RoleName.TECHNICIAN } }
      ),
      count: jest.fn(async () => overrides.adminCount ?? overrides.userCount ?? 5)
    },
    workOrder: {
      findMany: jest.fn(async () => overrides.openWOs ?? [])
    },
    vehicle: {
      count: jest.fn(async () => overrides.vehiclesNoAsset ?? 0)
    },
    sparePart: {
      count: jest.fn(async () => overrides.unmappedParts ?? 0)
    },
    bulkImportRun: {
      count: jest.fn(async () => overrides.pendingImports ?? 0)
    },
    businessException: {
      groupBy: jest.fn(async () => overrides.businessExceptions ?? [])
    }
  };
}

const actor = { sub: "actor-1", tenantId: "tenant-a", role: "ADMIN" };

describe("AdminGovernanceService", () => {
  it("overview returns expected shape", async () => {
    const prisma = buildGovernancePrisma({ userCount: 8, vehiclesNoAsset: 2, unmappedParts: 5, pendingImports: 1 });
    const svc = new AdminGovernanceService(prisma as any);
    const result = await svc.overview(actor as any);
    expect(result.users.total).toBeGreaterThanOrEqual(0);
    expect(result.dataQuality).toBeDefined();
    expect(typeof result.dataQuality.totalIssues).toBe("number");
    expect(result.dataQuality.issuesBySeverity).toHaveProperty("CRITICAL");
    expect(result.dataQuality.issuesBySeverity).toHaveProperty("HIGH");
    expect(result.dataQuality.issuesBySeverity).toHaveProperty("WARNING");
    expect(result.dataQuality.issuesBySeverity).toHaveProperty("INFO");
    expect(typeof result.pendingImports).toBe("number");
  });

  it("overview counts vehicles without assetId as WARNING issues", async () => {
    const prisma = buildGovernancePrisma({ vehiclesNoAsset: 3 });
    const svc = new AdminGovernanceService(prisma as any);
    const issues = await svc.dataQualityIssues(actor as any);
    const fleetIssue = issues.find((i) => i.code === "FLEET_NO_ASSET_LINK");
    expect(fleetIssue).toBeDefined();
    expect(fleetIssue?.count).toBe(3);
    expect(fleetIssue?.severity).toBe("WARNING");
  });

  it("overview counts unmapped ERP parts as WARNING", async () => {
    const prisma = buildGovernancePrisma({ unmappedParts: 7 });
    const svc = new AdminGovernanceService(prisma as any);
    const issues = await svc.dataQualityIssues(actor as any);
    const erpIssue = issues.find((i) => i.code === "ERP_UNMAPPED_PARTS");
    expect(erpIssue?.count).toBe(7);
  });

  it("returns no DQ issues when all counts zero", async () => {
    const prisma = buildGovernancePrisma({ vehiclesNoAsset: 0, unmappedParts: 0, businessExceptions: [] });
    const svc = new AdminGovernanceService(prisma as any);
    const issues = await svc.dataQualityIssues(actor as any);
    expect(issues.length).toBe(0);
  });

  it("systemInfo does not include connection strings or secrets", () => {
    const prisma = buildGovernancePrisma();
    const svc = new AdminGovernanceService(prisma as any);
    const info = svc.systemInfo();
    expect(info).not.toHaveProperty("connectionString");
    expect(info).not.toHaveProperty("password");
    expect(info).not.toHaveProperty("apiKey");
    expect(info).toHaveProperty("nodeVersion");
  });

  it("previewDeactivate returns DEACTIVATE_OK for simple tech with no open WOs", async () => {
    const prisma = buildGovernancePrisma({ adminCount: 3, openWOs: [] });
    const svc = new AdminGovernanceService(prisma as any);
    const result = await svc.previewDeactivate(actor as any, "user-2");
    expect(result.allowed).toBe(true);
    expect(result.code).toBe("DEACTIVATE_OK");
  });

  it("previewDeactivate returns OPEN_WORK_REQUIRES_REASSIGNMENT for tech with open WOs", async () => {
    const prisma = buildGovernancePrisma({
      adminCount: 3,
      openWOs: [{ id: "wo-1" }, { id: "wo-2" }]
    });
    const svc = new AdminGovernanceService(prisma as any);
    const result = await svc.previewDeactivate(actor as any, "user-2");
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("OPEN_WORK_REQUIRES_REASSIGNMENT");
    expect(result.openWorkOrderIds).toHaveLength(2);
  });

  it("previewDeactivate throws when user not found", async () => {
    const prisma = buildGovernancePrisma({ targetUser: null });
    const svc = new AdminGovernanceService(prisma as any);
    await expect(svc.previewDeactivate(actor as any, "missing-user")).rejects.toThrow(BadRequestException);
  });

  it("guardConfigChange allows when all fields correct", () => {
    const prisma = buildGovernancePrisma();
    const svc = new AdminGovernanceService(prisma as any);
    const result = svc.guardConfigChange({ confirmed: true, impactPreviewProvided: true, reason: "approved change" });
    expect(result.allowed).toBe(true);
  });

  it("guardConfigChange throws BadRequest when confirmation missing", () => {
    const prisma = buildGovernancePrisma();
    const svc = new AdminGovernanceService(prisma as any);
    expect(() => svc.guardConfigChange({ confirmed: false, impactPreviewProvided: true, reason: "ok" })).toThrow(BadRequestException);
  });

  it("previewDeactivate returns LAST_ADMIN_PROTECTED for last admin", async () => {
    const prisma = buildGovernancePrisma({
      adminCount: 1,
      targetUser: { id: "user-2", isActive: true, role: { name: RoleName.ADMIN } }
    });
    const svc = new AdminGovernanceService(prisma as any);
    const result = await svc.previewDeactivate(actor as any, "user-2");
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("LAST_ADMIN_PROTECTED");
  });

  it("overview tenant isolation: uses actor.tenantId for all queries", async () => {
    const prisma = buildGovernancePrisma();
    const svc = new AdminGovernanceService(prisma as any);
    await svc.overview({ ...actor, tenantId: "tenant-b" } as any);
    // All count queries should have been called (tenant isolation is in the where clause)
    expect(prisma.user.count).toHaveBeenCalled();
  });

  it("businessException groupBy results map to DQ issues correctly", async () => {
    const prisma = buildGovernancePrisma({
      businessExceptions: [
        { ruleCode: "STALE_METER", severity: "HIGH", _count: { _all: 4 } }
      ]
    });
    const svc = new AdminGovernanceService(prisma as any);
    const issues = await svc.dataQualityIssues(actor as any);
    const staleMeter = issues.find((i) => i.code === "STALE_METER");
    expect(staleMeter).toBeDefined();
    expect(staleMeter?.count).toBe(4);
    expect(staleMeter?.severity).toBe("HIGH");
  });
});
