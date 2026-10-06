"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Planning & scheduling — reuses maintenance forecast until dedicated planner lands. */
export default function MaintenancePlanningPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/maintenance/forecast");
  }, [router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
      Opening maintenance forecast…
    </div>
  );
}
