import { AppBrandLockup } from "@/components/brand/app-brand-lockup";

type MaintainProLogoProps = {
  showTagline?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "onDark";
  className?: string;
};

/** Product lockup. The company mark is the official Nelna Group logo. */
export function MaintainProLogo({
  showTagline = false,
  size = "md",
  variant = "default",
  className = ""
}: MaintainProLogoProps) {
  return <AppBrandLockup className={className} logoSize={size} showTagline={showTagline} variant={variant} />;
}
