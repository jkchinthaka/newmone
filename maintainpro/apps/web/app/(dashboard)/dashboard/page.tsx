import { redirect } from "next/navigation";

/**
 * Phase 1: Dashboard top-level nav retired; Home is `/action-center`.
 * RoleDashboard component retained for later Home KPI embedding (do not delete).
 */
export default function DashboardRedirectPage() {
  redirect("/action-center");
}
