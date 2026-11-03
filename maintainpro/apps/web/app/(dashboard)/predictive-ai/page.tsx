import { redirect } from "next/navigation";

/** The AI Copilot screen was removed (its API read data across tenants without permission checks). */
export default function PredictiveAiRemovedPage() {
  redirect("/dashboard");
}
