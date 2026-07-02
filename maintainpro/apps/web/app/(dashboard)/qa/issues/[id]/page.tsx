"use client";

import { QaIssueDetailPage } from "@/components/qa/qa-issue-detail-page";

export default function QaIssueDetailRoutePage({ params }: { params: { id: string } }) {
  return <QaIssueDetailPage issueId={params.id} />;
}
