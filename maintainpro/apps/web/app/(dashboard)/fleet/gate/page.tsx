"use client";

import { FleetGatePanel } from "@/components/fleet/fleet-gate-panel";
import { useCurrentUser } from "@/lib/use-current-user";

const GATE_ACCESS_ROLES = new Set([
  "SECURITY_OFFICER",
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "OPERATIONS_MANAGER",
  "FLEET_MANAGER"
]);

export default function FleetGatePage() {
  const user = useCurrentUser();

  if (!GATE_ACCESS_ROLES.has(user.role ?? "")) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <p className="font-semibold">Access restricted</p>
        <p className="mt-2">Fleet gate operations are limited to security and fleet management roles.</p>
      </div>
    );
  }

  return <FleetGatePanel />;
}
