import { redirect } from "next/navigation";

/** Planning & scheduling — reuses PM forecast calendar until dedicated planner lands. */
export default function MaintenancePlanningPage() {
  redirect("/maintenance/forecast");
}
