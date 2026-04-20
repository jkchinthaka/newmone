import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export const Card = ({ children, className }: CardProps) => {
  return <div className={cn("panel rounded-xl p-5 shadow-panel", className)}>{children}</div>;
};
