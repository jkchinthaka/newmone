import { NelnaLogo } from "@/components/brand/nelna-logo";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/branding";

type AppBrandLockupProps = {
  showTagline?: boolean;
  logoSize?: "sm" | "md" | "lg";
  variant?: "default" | "onDark";
  centered?: boolean;
  className?: string;
};

const titleSizes = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-xl"
} as const;

/**
 * Company logo (Nelna Farm) with MaintainPro product label — for sidebar, auth, and header brand areas.
 */
export function AppBrandLockup({
  showTagline = false,
  logoSize = "md",
  variant = "default",
  centered = false,
  className = ""
}: AppBrandLockupProps) {
  const isOnDark = variant === "onDark";
  const titleClass = titleSizes[logoSize === "lg" ? "lg" : logoSize === "sm" ? "sm" : "md"];

  return (
    <div
      className={`flex flex-col gap-2.5 ${centered ? "items-center text-center" : "items-start"} ${className}`.trim()}
    >
      <NelnaLogo priority={logoSize === "lg"} size={logoSize} />
      <div className={centered ? "min-w-0" : "min-w-0 w-full"}>
        <p
          className={`font-semibold tracking-tight ${titleClass} ${
            isOnDark ? "text-white" : "text-slate-900"
          }`}
        >
          {PRODUCT_NAME}
        </p>
        {showTagline ? (
          <p
            className={`mt-1 text-sm leading-5 ${isOnDark ? "text-white/78" : "text-slate-500"}`}
          >
            {PRODUCT_TAGLINE}
          </p>
        ) : null}
      </div>
    </div>
  );
}
