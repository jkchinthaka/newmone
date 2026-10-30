"use client";

import { sparklineBox } from "@/lib/meter-readings-display";

export function Spark({ points }: { points: Array<{ value: number }> }) {
  const box = sparklineBox(points);
  if (!box) return null;
  return (
    <svg
      width={box.width}
      height={box.height}
      viewBox={`0 0 ${box.width} ${box.height}`}
      role="img"
      aria-label="Sparkline"
      className="block h-10 w-full max-w-full"
    >
      <polyline
        fill="none"
        stroke="#166534"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={box.points}
      />
    </svg>
  );
}
