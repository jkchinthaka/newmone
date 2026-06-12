import Image from "next/image";

import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/branding";

type MaintainProLogoProps = {
  showTagline?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "onDark";
  className?: string;
};

const iconSizes = {
  sm: 36,
  md: 44,
  lg: 56
} as const;

const titleSizes = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl"
} as const;

export function MaintainProLogo({
  showTagline = false,
  size = "md",
  variant = "default",
  className = ""
}: MaintainProLogoProps) {
  const iconSize = iconSizes[size];
  const titleClass = titleSizes[size];
  const isOnDark = variant === "onDark";

  return (
    <div className={`flex items-start gap-3 ${className}`.trim()}>
      <Image
        alt=""
        aria-hidden
        className="shrink-0 rounded-2xl shadow-sm"
        height={iconSize}
        priority
        src="/favicon.svg"
        width={iconSize}
      />
      <div className="min-w-0">
        <p
          className={`font-semibold tracking-tight ${titleClass} ${
            isOnDark ? "text-white" : "text-slate-900"
          }`}
        >
          {PRODUCT_NAME}
        </p>
        {showTagline ? (
          <p
            className={`mt-1 text-sm leading-5 ${
              isOnDark ? "text-white/78" : "text-slate-500"
            }`}
          >
            {PRODUCT_TAGLINE}
          </p>
        ) : null}
      </div>
    </div>
  );
}
