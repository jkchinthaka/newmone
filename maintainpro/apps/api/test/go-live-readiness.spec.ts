import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

describe("go-live readiness pack (UAT-023)", () => {
  const root = path.join(__dirname, "..", "..", "..");

  const pilotDocs = [
    "docs/go-live/pilot-rollout-plan.md",
    "docs/go-live/performance-test-report.md",
    "docs/go-live/backup-restore-test-report.md",
    "docs/go-live/security-review-report.md",
    "docs/go-live/management-sign-off.md",
    "docs/go-live/final-go-live-checklist.md",
    "docs/go-live/pilot-support-process.md",
    "docs/go-live/pilot-feedback-form.md",
    "docs/go-live/live-monitoring-plan.md",
    "docs/go-live/cutover-plan.md"
  ];

  const trainingDocs = [
    "technician-training.md",
    "supervisor-training.md",
    "storekeeper-training.md",
    "manager-training.md",
    "finance-training.md",
    "security-training.md",
    "admin-training.md"
  ].map((name) => `docs/go-live/training/${name}`);

  const sopDocs = [
    "work-order-create-sop.md",
    "work-order-assignment-sop.md",
    "technician-completion-sop.md",
    "supervisor-verification-sop.md",
    "parts-issue-return-sop.md",
    "vendor-repair-sop.md",
    "finance-invoice-approval-sop.md",
    "gate-restriction-sop.md",
    "admin-override-sop.md",
    "management-report-review-sop.md",
    "incident-reporting-sop.md",
    "change-request-sop.md"
  ].map((name) => `docs/go-live/sop/${name}`);

  const allDocs = [...pilotDocs, ...trainingDocs, ...sopDocs];

  it.each(allDocs)("includes go-live document %s", (relPath) => {
    const full = path.join(root, relPath);
    expect(existsSync(full)).toBe(true);
    const content = readFileSync(full, "utf8");
    expect(content.trim().length).toBeGreaterThan(200);
  });

  it("final go-live checklist defines rollout verdict levels", () => {
    const content = readFileSync(path.join(root, "docs/go-live/final-go-live-checklist.md"), "utf8");
    expect(content).toMatch(/Pilot/i);
    expect(content).toMatch(/Full production|Department/i);
    expect(content).toMatch(/NO-GO/i);
  });

  it("pilot rollout plan references core workflows", () => {
    const content = readFileSync(path.join(root, "docs/go-live/pilot-rollout-plan.md"), "utf8");
    expect(content).toMatch(/Work Order/i);
    expect(content).toMatch(/evidence/i);
    expect(content).toMatch(/supervisor/i);
  });

  it("management sign-off requires department owners", () => {
    const content = readFileSync(path.join(root, "docs/go-live/management-sign-off.md"), "utf8");
    expect(content).toMatch(/Maintenance Manager/i);
    expect(content).toMatch(/sign-off/i);
  });

  it("uat index includes UAT-023", () => {
    const content = readFileSync(path.join(root, "docs/go-live/uat-index.md"), "utf8");
    expect(content).toMatch(/UAT-023/i);
  });
});
