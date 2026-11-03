import { RouteLoading } from "@/components/ui/route-loading";

/**
 * Instant, lightweight boundary for every dashboard route: the shell (menu, top bar) stays,
 * and the page area shows a small spinner while the next page's code and data load.
 */
export default function Loading() {
  return <RouteLoading title="Loading" description="Opening the page." />;
}
