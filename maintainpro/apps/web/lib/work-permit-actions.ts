/**
 * Buttons shown for a work permit. Mirrors the API rule: only Admin / Super Admin approve a
 * permit (or let a suspended one carry on). An admin may approve a permit they raised.
 */
export type PermitActionInput = { status: string; issuedById?: string | null };
export type PermitActor = { id: string | null; role: string | null };
export type PermitAction = { status: string; label: string; disabledReason?: string };

export function isPermitApprover(role: string | null | undefined): boolean {
  const normalized = String(role ?? "").toUpperCase();
  return normalized === "ADMIN" || normalized === "SUPER_ADMIN";
}

function adminGate(_permit: PermitActionInput, actor: PermitActor): string | undefined {
  if (!isPermitApprover(actor.role)) return "Admin only";
  return undefined;
}

export function permitActions(permit: PermitActionInput, actor: PermitActor): PermitAction[] {
  switch (permit.status) {
    case "DRAFT":
      return [
        { status: "APPROVED", label: "Approve", disabledReason: adminGate(permit, actor) },
        { status: "CLOSED", label: "Close" }
      ];
    case "APPROVED":
      return [
        { status: "ACTIVE", label: "Activate" },
        { status: "CLOSED", label: "Close" }
      ];
    case "ACTIVE":
      return [
        { status: "SUSPENDED", label: "Suspend" },
        { status: "CLOSED", label: "Close" }
      ];
    case "SUSPENDED":
      return [
        { status: "ACTIVE", label: "Resume", disabledReason: adminGate(permit, actor) },
        { status: "CLOSED", label: "Close" }
      ];
    case "EXPIRED":
      return [{ status: "CLOSED", label: "Close" }];
    default:
      return [];
  }
}
