import { LoadingState } from "@/components/ui/page-state";

type RouteLoadingProps = {
  title: string;
  description?: string;
};

export function RouteLoading({ title, description }: RouteLoadingProps) {
  return (
    <div className="p-1">
      <LoadingState description={description} title={title} />
    </div>
  );
}
