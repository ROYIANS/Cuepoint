import { createFileRoute } from "@tanstack/react-router";
import { ProducePage } from "@/components/produce/ProducePage";

export const Route = createFileRoute("/p/$projectId/produce")({
  component: ProduceRoute,
});

function ProduceRoute() {
  const { projectId } = Route.useParams();
  return <ProducePage projectId={projectId} />;
}
