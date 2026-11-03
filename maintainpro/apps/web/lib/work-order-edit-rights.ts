/**
 * Mirrors the API rule (work-order-edit-rights.ts): after a job is created only Admin and
 * Super Admin change its title, description, cost and hour estimates. Managers plan it
 * (dates, technician) but cannot rewrite the work itself.
 */
export function canEditJobDetails(role: string | null | undefined): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}
