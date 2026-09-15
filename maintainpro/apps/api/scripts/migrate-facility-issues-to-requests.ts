/**
 * Phase 5 FacilityIssue → MaintenanceRequest bridge (non-destructive).
 *
 * Dry-run by default. Does not delete FacilityIssue rows.
 * Traceability: MaintenanceRequest.legacySourceType = "FacilityIssue",
 *               MaintenanceRequest.legacySourceId = FacilityIssue.id
 *
 * Usage (from maintainpro/):
 *   npx ts-node --transpile-only apps/api/scripts/migrate-facility-issues-to-requests.ts
 *   npx ts-node --transpile-only apps/api/scripts/migrate-facility-issues-to-requests.ts --apply
 *   npx ts-node --transpile-only apps/api/scripts/migrate-facility-issues-to-requests.ts --tenant=<id> --apply
 */

import { PrismaClient, Priority, MaintenanceRequestStatus } from "@prisma/client";

const prisma = new PrismaClient();

type Args = { apply: boolean; tenantId?: string };

function parseArgs(argv: string[]): Args {
  const apply = argv.includes("--apply");
  const tenantArg = argv.find((a) => a.startsWith("--tenant="));
  return {
    apply,
    tenantId: tenantArg ? tenantArg.slice("--tenant=".length) : undefined
  };
}

function mapSeverity(severity: string | null | undefined): Priority {
  const s = String(severity ?? "MEDIUM").toUpperCase();
  if (s === "CRITICAL" || s === "HIGH" || s === "LOW" || s === "MEDIUM") {
    return s as Priority;
  }
  return Priority.MEDIUM;
}

function mapStatus(status: string | null | undefined): MaintenanceRequestStatus | "SKIP" {
  const s = String(status ?? "").toUpperCase();
  // FacilityIssue statuses vary; only migrate open-like issues into NEW for supervisor re-triage.
  if (["OPEN", "NEW", "REPORTED", "PENDING"].includes(s)) return MaintenanceRequestStatus.NEW;
  if (["IN_PROGRESS", "ASSIGNED", "UNDER_REVIEW"].includes(s)) {
    return MaintenanceRequestStatus.UNDER_REVIEW;
  }
  if (["RESOLVED", "CLOSED", "COMPLETED"].includes(s)) return "SKIP";
  if (["CANCELLED", "CANCELED", "REJECTED"].includes(s)) return "SKIP";
  return MaintenanceRequestStatus.NEW;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const issues = await prisma.facilityIssue.findMany({
    where: args.tenantId ? { tenantId: args.tenantId } : { tenantId: { not: null } },
    take: 5000,
    orderBy: { createdAt: "asc" }
  });

  const summary = {
    scanned: issues.length,
    wouldCreate: 0,
    created: 0,
    skippedExisting: 0,
    skippedClosed: 0,
    skippedNoTenant: 0,
    unresolved: [] as string[]
  };

  for (const issue of issues) {
    if (!issue.tenantId) {
      summary.skippedNoTenant += 1;
      continue;
    }

    const existing = await prisma.maintenanceRequest.findFirst({
      where: {
        tenantId: issue.tenantId,
        legacySourceType: "FacilityIssue",
        legacySourceId: issue.id
      },
      select: { id: true }
    });
    if (existing) {
      summary.skippedExisting += 1;
      continue;
    }

    const status = mapStatus(issue.status);
    if (status === "SKIP") {
      summary.skippedClosed += 1;
      continue;
    }

    // FacilityIssue is location/room oriented — without Phase 3 FL mapping we cannot invent assetId.
    void status;
    void mapSeverity(issue.severity);
    summary.unresolved.push(issue.id);
    summary.wouldCreate += 1;

    if (!args.apply) {
      continue;
    }

    console.warn(
      `[skip-apply] FacilityIssue ${issue.id} needs FunctionalLocation mapping before MaintenanceRequest create`
    );
  }

  console.log(
    JSON.stringify(
      {
        mode: args.apply ? "apply" : "dry-run",
        tenantId: args.tenantId ?? null,
        ...summary,
        note:
          "FacilityIssue rows are retained. Open issues need FunctionalLocation mapping before idempotent create. See docs/PHASE_05_REQUEST_MIGRATION.md."
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
