import { RoleLandingRedirect } from "@/components/layout/role-landing-redirect";

/** Legacy /dashboard bookmark. Lands on the role module, not Action Center. */
export default function DashboardRedirectPage() {
  return <RoleLandingRedirect />;
}
