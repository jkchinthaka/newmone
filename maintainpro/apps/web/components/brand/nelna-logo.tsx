import Image from "next/image";

/** Pixel size of `public/brand/nelna-group-logo.jpg`. CSS caps the rendered size. */
export const NELNA_LOGO_WIDTH = 725;
export const NELNA_LOGO_HEIGHT = 563;
export const NELNA_LOGO_SRC = "/brand/nelna-group-logo.jpg";
export const NELNA_LOGO_ALT = "Nelna Group";

type NelnaLogoSize = "compact" | "sm" | "md" | "lg";

type NelnaLogoProps = {
  size?: NelnaLogoSize;
  priority?: boolean;
  className?: string;
  /** Hide the name from assistive tech when the product name is already read nearby. */
  decorative?: boolean;
};

const sizeClasses: Record<NelnaLogoSize, string> = {
  compact: "w-14",
  sm: "w-[104px]",
  md: "w-[132px]",
  lg: "w-[160px]"
};

/**
 * Official Nelna Group mark, used as supplied.
 * The JPEG has a white field, so it sits on a white surface.
 * A square favicon was not derived from this artwork.
 */
export function NelnaLogo({ size = "md", priority = false, className = "", decorative = false }: NelnaLogoProps) {
  return (
    <span className={`inline-flex shrink-0 rounded-md bg-white p-1 ${className}`.trim()}>
      <Image
        alt={decorative ? "" : NELNA_LOGO_ALT}
        aria-hidden={decorative ? true : undefined}
        className={`h-auto ${sizeClasses[size]} object-contain`}
        height={NELNA_LOGO_HEIGHT}
        priority={priority}
        src={NELNA_LOGO_SRC}
        width={NELNA_LOGO_WIDTH}
      />
    </span>
  );
}
