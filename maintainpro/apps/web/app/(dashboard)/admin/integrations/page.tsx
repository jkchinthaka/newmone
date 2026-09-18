import { redirect } from "next/navigation";

/** Integrations readiness lives under Technical Administration. */
export default function AdminIntegrationsRedirectPage() {
  redirect("/system-health");
}
