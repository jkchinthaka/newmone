import {
  canWriteBulkRows,
  evaluateHighImpactConfigChange,
  evaluateUserDeactivation,
  nextBulkImportStage
} from "../src/modules/admin-governance/admin-safety";
import { DATA_QUALITY_RULES, MAINTENANCE_ADMIN_SECTIONS } from "../src/modules/admin-governance/admin-catalog";
import { RoleName } from "@prisma/client";

describe("Phase 12 admin safety", () => {
  it("blocks self-deactivate and last admin", () => {
    expect(
      evaluateUserDeactivation({
        actorId: "u1",
        targetUserId: "u1",
        targetRole: RoleName.ADMIN,
        targetIsActive: true,
        nextIsActive: false,
        activeAdminCount: 3
      }).code
    ).toBe("SELF_DEACTIVATE_BLOCKED");

    expect(
      evaluateUserDeactivation({
        actorId: "u1",
        targetUserId: "u2",
        targetRole: RoleName.ADMIN,
        targetIsActive: true,
        nextIsActive: false,
        activeAdminCount: 1
      }).code
    ).toBe("LAST_ADMIN_PROTECTED");
  });

  it("requires reassignment when technician has open work", () => {
    const decision = evaluateUserDeactivation({
      actorId: "admin",
      targetUserId: "tech-1",
      targetRole: RoleName.TECHNICIAN,
      targetIsActive: true,
      nextIsActive: false,
      activeAdminCount: 2,
      openWorkOrderIds: ["wo-1", "wo-2"]
    });
    expect(decision.allowed).toBe(false);
    expect(decision.requireReassignment).toBe(true);
    expect(decision.openWorkOrderIds).toHaveLength(2);
  });

  it("guards high-impact config changes", () => {
    expect(
      evaluateHighImpactConfigChange({
        confirmed: false,
        impactPreviewProvided: true,
        reason: "change SLA"
      }).allowed
    ).toBe(false);
    expect(
      evaluateHighImpactConfigChange({
        confirmed: true,
        impactPreviewProvided: true,
        reason: "change SLA"
      }).code
    ).toBe("CONFIG_CHANGE_OK");
  });

  it("never writes bulk rows before validate+confirm", () => {
    expect(canWriteBulkRows("UPLOAD", false, false)).toBe(false);
    expect(canWriteBulkRows("PREVIEW", true, false)).toBe(false);
    expect(canWriteBulkRows("IMPORT", true, true)).toBe(true);
    expect(nextBulkImportStage("PREVIEW", true)).toBe("SHOW_ERRORS");
  });

  it("exposes operational admin structure and data-quality rules", () => {
    const ids = MAINTENANCE_ADMIN_SECTIONS.map((s) => s.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "overview",
        "organization",
        "assets-master",
        "people-access",
        "maintenance-setup",
        "approvals",
        "fleet-setup",
        "vendors-contracts",
        "erp-parts",
        "data-quality",
        "audit-log",
        "technical"
      ])
    );
    expect(DATA_QUALITY_RULES.map((r) => r.code)).toContain("STALE_METER");
    expect(DATA_QUALITY_RULES.map((r) => r.code)).toContain("EXPIRED_COMPLIANCE");
  });
});
