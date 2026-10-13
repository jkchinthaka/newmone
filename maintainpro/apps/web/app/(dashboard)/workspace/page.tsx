import { RoleLandingRedirect } from "@/components/layout/role-landing-redirect";

/** Legacy /workspace bookmark. Lands on the role module, not Action Center. */
export default function WorkspaceRedirectPage() {
  return <RoleLandingRedirect />;
}
