"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";

export function Spark({ points }: { points: Array<{ value: number }> }) {
  return (
    <div className="h-10 w-full" role="img" aria-label="Sparkline">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <Line type="monotone" dataKey="value" stroke="#176B3A" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
