import type { ReactNode } from "react";

import { EmptyState } from "@/components/ui/page-state";
import type { ActionCenterItem, ActionCenterSection } from "@/lib/action-center";

import { ActionCard } from "./action-card";

type ActionSectionProps = {
  section: ActionCenterSection;
  children?: ReactNode;
};

export function ActionSection({ section, children }: ActionSectionProps) {
  const hasItems = section.items.length > 0;

  return (
    <section aria-labelledby={`action-section-${section.id}`} className="space-y-3">
      <header>
        <h3 id={`action-section-${section.id}`} className="text-base font-semibold text-slate-900">
          {section.title}
        </h3>
        {section.description ? <p className="mt-1 text-sm text-slate-500">{section.description}</p> : null}
      </header>

      {hasItems ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{renderItems(section.items)}</div>
      ) : section.emptyTitle ? (
        <EmptyState
          title={section.emptyTitle}
          description={section.emptyDescription ?? "Try again later or open the related module directly."}
        />
      ) : null}

      {children}
    </section>
  );
}

function renderItems(items: ActionCenterItem[]) {
  return items.map((item) => <ActionCard key={item.id} item={item} />);
}
