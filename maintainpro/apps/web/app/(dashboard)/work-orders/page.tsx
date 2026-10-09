import { redirect } from "next/navigation";

import { canonicalizeWorkOrderSearch } from "@/lib/operational-deep-link";

/**
 * /work-orders stays as the deep-link address used by queues and work-order ids.
 * The board itself is /maintenance/jobs so All Jobs and Work Orders are one page.
 */
export default function WorkOrdersRoutePage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") query.set(key, value);
    else if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
  }
  canonicalizeWorkOrderSearch(query);
  const suffix = query.toString();
  redirect(suffix ? `/maintenance/jobs?${suffix}` : "/maintenance/jobs");
}
