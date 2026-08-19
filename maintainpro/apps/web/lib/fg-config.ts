export function isFgNextjsUiEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  const raw = (
    env.NEXT_PUBLIC_FG_NEXTJS_UI_ENABLED ||
    env.FG_NEXTJS_UI_ENABLED ||
    ""
  )
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export const FG_HANDOFF_PATH = "/api/fg-sso/handoff";
export const FG_BFF_PREFIX = "/fg/api/v1";
export const FG_SESSION_COOKIE = "fg_sessionid";
export const FG_SSO_ASSERTION_COOKIE = "fg_sso_assertion";
