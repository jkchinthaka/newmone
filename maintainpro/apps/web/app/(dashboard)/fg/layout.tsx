import { FgLegacyRedirect } from "@/components/fg/fg-legacy-redirect";
import { FG_HANDOFF_PATH, isFgNextjsUiEnabled } from "@/lib/fg-config";

export default function FgSectionLayout({ children }: { children: React.ReactNode }) {
  if (!isFgNextjsUiEnabled()) {
    return <FgLegacyRedirect href={`${FG_HANDOFF_PATH}?next=/fg/`} />;
  }
  return <div className="mx-auto max-w-6xl space-y-4">{children}</div>;
}
