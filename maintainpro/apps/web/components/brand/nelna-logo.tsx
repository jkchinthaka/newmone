import Image from "next/image";

/** Intrinsic dimensions of `/brand/nelna-logo.png` — used for aspect ratio; rendered size is capped via CSS. */
const LOGO_WIDTH = 1024;
const LOGO_HEIGHT = 649;

type NelnaLogoSize = "sm" | "md" | "lg";

type NelnaLogoProps = {
  size?: NelnaLogoSize;
  priority?: boolean;
  className?: string;
};

const sizeClasses: Record<NelnaLogoSize, string> = {
  sm: "max-h-10 max-w-[140px]",
  md: "max-h-14 max-w-[180px]",
  lg: "max-h-20 max-w-[240px]"
};

/**
 * Official Nelna Farm company mark.
 *
 * TODO(brand): Create a simplified square icon from this artwork for favicon / PWA manifest
 * (`public/favicon.svg`, `app/icon.png`). Do not reuse the full shield logo at favicon sizes.
 */
export function NelnaLogo({ size = "md", priority = false, className = "" }: NelnaLogoProps) {
  return (
    <Image
      alt="Nelna Farm logo"
      className={`h-auto w-auto shrink-0 object-contain ${sizeClasses[size]} ${className}`.trim()}
      height={LOGO_HEIGHT}
      priority={priority}
      src="/brand/nelna-logo.png"
      width={LOGO_WIDTH}
    />
  );
}
