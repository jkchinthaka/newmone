import { type ReactNode } from "react";

import { Card } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
}

export const StatCard = ({ label, value, hint, icon }: StatCardProps) => {
  return (
    <Card className="min-h-[128px]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
          {hint ? <p className="mt-2 text-xs text-slate-500">{hint}</p> : null}
        </div>
        {icon ? <div className="text-brand-600">{icon}</div> : null}
      </div>
    </Card>
  );
};
