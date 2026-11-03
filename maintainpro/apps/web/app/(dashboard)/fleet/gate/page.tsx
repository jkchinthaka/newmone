import { redirect } from "next/navigation";

import { retiredGateTarget } from "@/lib/notification-inbox";

/**
 * The gate screen was retired from the UI (gate APIs and safety checks still run on the server).
 * Old bookmarks and notification links land on the vehicle record or the fleet list; roles that
 * cannot open the fleet list are sent to their own home by the navigation route guard.
 */
export default function RetiredFleetGatePage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const vehicle = searchParams?.vehicle;
  const query = typeof vehicle === "string" && vehicle ? `?vehicle=${encodeURIComponent(vehicle)}` : "";
  redirect(retiredGateTarget(`/fleet/gate${query}`) ?? "/fleet");
}
