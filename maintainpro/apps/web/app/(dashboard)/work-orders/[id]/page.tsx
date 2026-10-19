import { redirect } from "next/navigation";

/**
 * /work-orders/{id} opens the same detail as the queue deep link.
 * An empty id falls through to the jobs board.
 */
export default function WorkOrderByIdPage({ params }: { params: { id: string } }) {
  const id = params.id?.trim();
  if (!id) redirect("/maintenance/jobs");
  redirect(`/maintenance/jobs?wo=${encodeURIComponent(id)}`);
}
