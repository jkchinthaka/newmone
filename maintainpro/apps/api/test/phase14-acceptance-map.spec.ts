/**
 * Phase 14 — Acceptance Coverage Map
 *
 * Machine-readable map of the 33 Phase 14 acceptance items to automated
 * evidence files. Tests assert that evidence files exist (fs.existsSync) and
 * that the coverage table is consistent.
 *
 * Status legend:
 *   automated     — covered by an existing *.spec.ts in apps/api/test/
 *   manual_uat    — requires human tester on a staging browser session
 *   operator      — operator-owned action (DB push, credentials, restore drill)
 */

import * as fs from "fs";
import * as path from "path";

// __dirname resolves to apps/api/test/ (where spec files live)
const TEST_DIR = path.resolve(__dirname);

function testFile(name: string): string {
  return path.join(TEST_DIR, name);
}

type AcceptanceStatus = "automated" | "manual_uat" | "operator";

interface AcceptanceItem {
  id: number;
  name: string;
  status: AcceptanceStatus;
  evidenceFile?: string;
  note?: string;
}

const ACCEPTANCE_MAP: AcceptanceItem[] = [
  // ── Phase 0–5: Request → WO lifecycle ──────────────────────────────────────
  {
    id: 1,
    name: "Maintenance request create (requester role)",
    status: "automated",
    evidenceFile: "work-order-lifecycle-phase06.spec.ts",
  },
  {
    id: 2,
    name: "Request triage and priority assignment",
    status: "automated",
    evidenceFile: "work-order-lifecycle-phase06.spec.ts",
  },
  {
    id: 3,
    name: "Work order create from request",
    status: "automated",
    evidenceFile: "work-order-lifecycle-phase06.spec.ts",
  },
  {
    id: 4,
    name: "WO assignment to technician",
    status: "automated",
    evidenceFile: "work-orders-approval.spec.ts",
  },
  {
    id: 5,
    name: "WO in-progress → TECHNICIAN_COMPLETED transition",
    status: "automated",
    evidenceFile: "work-orders-status-transition.spec.ts",
  },
  {
    id: 6,
    name: "WO verification by supervisor",
    status: "automated",
    evidenceFile: "work-orders-governance.spec.ts",
  },
  {
    id: 7,
    name: "WO close and audit record created",
    status: "automated",
    evidenceFile: "work-order-activity-timeline.spec.ts",
  },
  {
    id: 8,
    name: "WO approval engine: auto-approve below threshold",
    status: "automated",
    evidenceFile: "approval-engine-phase07.spec.ts",
  },
  {
    id: 9,
    name: "WO approval engine: escalate above threshold",
    status: "automated",
    evidenceFile: "approval-engine-phase07.spec.ts",
  },
  {
    id: 10,
    name: "OVERDUE derived status — closed WO NOT counted",
    status: "automated",
    evidenceFile: "reporting-kpis-phase13.spec.ts",
    note: "isTerminalStatus guard enforced in kpi-definitions.ts",
  },
  {
    id: 11,
    name: "Cross-tenant isolation — WOs not visible across tenants",
    status: "automated",
    evidenceFile: "cross-tenant-isolation.spec.ts",
  },
  {
    id: 12,
    name: "RBAC: TECHNICIAN cannot close own WO without verification",
    status: "automated",
    evidenceFile: "work-orders-governance.spec.ts",
  },
  {
    id: 13,
    name: "Parts issue against WO (inventory deduct)",
    status: "automated",
    evidenceFile: "work-order-parts-governance.spec.ts",
  },
  {
    id: 14,
    name: "Asset maintenance history linked via WO",
    status: "automated",
    evidenceFile: "work-order-activity-timeline.spec.ts",
  },

  // ── Phase 8: PM / Planning ─────────────────────────────────────────────────
  {
    id: 15,
    name: "PM calendar trigger creates WO at due date",
    status: "automated",
    evidenceFile: "planning-phase08.spec.ts",
  },
  {
    id: 16,
    name: "Meter-based trigger fires at threshold",
    status: "automated",
    evidenceFile: "planning-phase08.spec.ts",
  },
  {
    id: 17,
    name: "Combined trigger (calendar OR meter) fires on first condition",
    status: "automated",
    evidenceFile: "planning-phase08.spec.ts",
  },
  {
    id: 18,
    name: "Compliance expiry alert triggers corrective WO",
    status: "automated",
    evidenceFile: "planning-phase08.spec.ts",
  },
  {
    id: 19,
    name: "Failed inspection creates corrective WO",
    status: "automated",
    evidenceFile: "planning-phase08.spec.ts",
  },
  {
    id: 20,
    name: "Calibration FAIL triggers follow-up workflow",
    status: "automated",
    evidenceFile: "planning-phase08.spec.ts",
  },

  // ── Phase 9: Parts / ERP / Vendors ────────────────────────────────────────
  {
    id: 21,
    name: "Vendor/external WO assignment and execution mode",
    status: "automated",
    evidenceFile: "maintenance-supply-phase09.spec.ts",
  },
  {
    id: 22,
    name: "ERP boundary: mock sync never reported as production success",
    status: "automated",
    evidenceFile: "maintenance-supply-phase09.spec.ts",
    note: "erpSyncOutcome enforced in supply-boundary.ts",
  },

  // ── Phase 10: Fleet lifecycle ──────────────────────────────────────────────
  {
    id: 23,
    name: "Fleet vehicle service job created and closed",
    status: "automated",
    evidenceFile: "fleet-lifecycle-phase10.spec.ts",
  },
  {
    id: 24,
    name: "Gate blocking: overdue service prevents gate-out",
    status: "automated",
    evidenceFile: "fleet-lifecycle-phase10.spec.ts",
  },
  {
    id: 25,
    name: "Gate override requires MANAGER approval and audit fields",
    status: "automated",
    evidenceFile: "fleet-lifecycle-phase10.spec.ts",
  },
  {
    id: 26,
    name: "Accident → repair WO → insurance claim chain",
    status: "automated",
    evidenceFile: "fleet-lifecycle-phase10.spec.ts",
  },

  // ── Phase 12: Admin governance ────────────────────────────────────────────
  {
    id: 27,
    name: "Admin safety: last active admin cannot be deactivated",
    status: "automated",
    evidenceFile: "admin-governance-phase12.spec.ts",
  },
  {
    id: 28,
    name: "Data-quality rules: admin catalog validation",
    status: "automated",
    evidenceFile: "admin-governance-phase12.spec.ts",
  },

  // ── Phase 13: KPI reporting ───────────────────────────────────────────────
  {
    id: 29,
    name: "KPI formulas produce correct values from fixture data",
    status: "automated",
    evidenceFile: "reporting-kpis-phase13.spec.ts",
  },

  // ── Operator / manual items ───────────────────────────────────────────────
  {
    id: 30,
    name: "Responsive layout on mobile/tablet devices",
    status: "manual_uat",
    note: "Existing DataTable/mobile patterns; manual device QA remains operator-owned",
  },
  {
    id: 31,
    name: "PWA offline duplicate prevention (offline queue)",
    status: "manual_uat",
    note: "Existing offline queue in mobile app; not newly revalidated this phase",
  },
  {
    id: 32,
    name: "Full audit trail visible in Admin > Audit section",
    status: "manual_uat",
    note: "AuditLog model + admin audit section; human review on staging",
  },
  {
    id: 33,
    name: "Backup / restore drill executed and verified",
    status: "operator",
    note: "OPEN BLOCKER — OPERATOR_ACTION_REQUIRED before production go-live",
  },
];

// ─── Derived sets ─────────────────────────────────────────────────────────────

const AUTOMATED_ITEMS = ACCEPTANCE_MAP.filter((i) => i.status === "automated");
const MANUAL_ITEMS = ACCEPTANCE_MAP.filter((i) => i.status === "manual_uat");
const OPERATOR_ITEMS = ACCEPTANCE_MAP.filter((i) => i.status === "operator");

const EVIDENCE_FILES = [
  "work-order-lifecycle-phase06.spec.ts",
  "work-orders-approval.spec.ts",
  "work-orders-status-transition.spec.ts",
  "work-orders-governance.spec.ts",
  "work-order-activity-timeline.spec.ts",
  "work-order-parts-governance.spec.ts",
  "approval-engine-phase07.spec.ts",
  "cross-tenant-isolation.spec.ts",
  "planning-phase08.spec.ts",
  "maintenance-supply-phase09.spec.ts",
  "fleet-lifecycle-phase10.spec.ts",
  "domain-coverage-phase11.spec.ts",
  "admin-governance-phase12.spec.ts",
  "reporting-kpis-phase13.spec.ts",
  "auth-throttling.spec.ts",
  "admin-console.spec.ts",
];

// ─── Test suite ───────────────────────────────────────────────────────────────

describe("Phase 14 acceptance coverage map", () => {
  describe("map completeness", () => {
    it("covers all 33 acceptance items", () => {
      expect(ACCEPTANCE_MAP).toHaveLength(33);
    });

    it("ids are sequential 1–33", () => {
      const ids = ACCEPTANCE_MAP.map((i) => i.id).sort((a, b) => a - b);
      for (let n = 1; n <= 33; n++) {
        expect(ids).toContain(n);
      }
    });

    it("items 15–29 are all automated", () => {
      const automatedIds = AUTOMATED_ITEMS.map((i) => i.id);
      for (let n = 15; n <= 29; n++) {
        expect(automatedIds).toContain(n);
      }
    });

    it("items 30–32 are manual_uat, 33 is operator", () => {
      const manualIds = MANUAL_ITEMS.map((i) => i.id);
      expect(manualIds).toContain(30);
      expect(manualIds).toContain(31);
      expect(manualIds).toContain(32);
      const operatorIds = OPERATOR_ITEMS.map((i) => i.id);
      expect(operatorIds).toContain(33);
    });

    it("every automated item has an evidenceFile", () => {
      for (const item of AUTOMATED_ITEMS) {
        expect(item.evidenceFile).toBeTruthy();
        expect(typeof item.evidenceFile).toBe("string");
        expect((item.evidenceFile as string).length).toBeGreaterThan(5);
      }
    });

    it("every item has a non-empty name", () => {
      for (const item of ACCEPTANCE_MAP) {
        expect(item.name.length).toBeGreaterThan(5);
      }
    });
  });

  describe("evidence files exist on disk", () => {
    for (const file of EVIDENCE_FILES) {
      it(`evidence file exists: ${file}`, () => {
        const fullPath = testFile(file);
        expect(fs.existsSync(fullPath)).toBe(true);
      });
    }
  });

  describe("additional domain-coverage evidence", () => {
    it("domain-coverage-phase11.spec.ts exists (Phase 11 domain profiles)", () => {
      expect(fs.existsSync(testFile("domain-coverage-phase11.spec.ts"))).toBe(true);
    });

    it("auth-throttling.spec.ts exists (security hardening)", () => {
      expect(fs.existsSync(testFile("auth-throttling.spec.ts"))).toBe(true);
    });

    it("admin-console.spec.ts exists (admin module coverage)", () => {
      expect(fs.existsSync(testFile("admin-console.spec.ts"))).toBe(true);
    });
  });

  describe("backup/restore blocker documented", () => {
    it("item 33 is explicitly marked as operator-owned blocker", () => {
      const item33 = ACCEPTANCE_MAP.find((i) => i.id === 33);
      expect(item33).toBeDefined();
      expect(item33!.status).toBe("operator");
      expect(item33!.note).toMatch(/OPERATOR_ACTION_REQUIRED|blocker|operator/i);
    });
  });

  describe("coverage summary", () => {
    it("majority of acceptance items (≥24 of 33) are automated", () => {
      expect(AUTOMATED_ITEMS.length).toBeGreaterThanOrEqual(24);
    });

    it("documents automated count, manual_uat count, operator count", () => {
      // Soft assertion — documents current state
      const summary = {
        automated: AUTOMATED_ITEMS.length,
        manual_uat: MANUAL_ITEMS.length,
        operator: OPERATOR_ITEMS.length,
        total: ACCEPTANCE_MAP.length,
      };
      expect(summary.total).toBe(33);
      expect(summary.automated + summary.manual_uat + summary.operator).toBe(33);
    });
  });
});
