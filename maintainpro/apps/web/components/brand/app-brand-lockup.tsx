import { NelnaLogo } from "@/components/brand/nelna-logo";
import { PRODUCT_NAME } from "@/lib/branding";

export const BRAND_PRODUCT_LINE = "Maintenance Management System";

type AppBrandLockupProps = {
  showTagline?: boolean;
  logoSize?: "sm" | "md" | "lg";
  variant?: "default" | "onDark";
  centered?: boolean;
  compact?: boolean;
  className?: string;
};

const titleSizes = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg"
} as const;

/** Nelna Group mark with the MaintainPro product name. */
export function AppBrandLockup({
  showTagline = false,
  logoSize = "md",
  variant = "default",
  centered = false,
  compact = false,
  className = ""
}: AppBrandLockupProps) {
  const isOnDark = variant === "onDark";
  const titleClass = titleSizes[logoSize === "lg" ? "lg" : logoSize === "sm" ? "sm" : "md"];

  return (
    <div
      className={`flex min-w-0 flex-col gap-1.5 ${centered ? "items-center text-center" : "items-start"} ${className}`.trim()}
    >
      <NelnaLogo decorative={compact} priority={logoSize === "lg"} size={compact ? "compact" : logoSize} />
      <div className="min-w-0">
        <p className={`font-semibold tracking-tight ${titleClass} ${isOnDark ? "text-white" : "text-ink"}`}>
          {PRODUCT_NAME}
        </p>
        {showTagline ? (
          <p className={`text-xs leading-4 ${isOnDark ? "text-white/80" : "text-slate-500"}`}>{BRAND_PRODUCT_LINE}</p>
        ) : null}
      </div>
    </div>
  );
}
