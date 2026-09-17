import { createFileRoute } from "@tanstack/react-router";
import { ProducePage } from "@/components/produce/ProducePage";

export const Route = createFileRoute("/p/$projectId/e/$episodeId/produce")({
  component: EpisodeProduceRoute,
});

function EpisodeProduceRoute() {
  const { projectId, episodeId } = Route.useParams();
  return <ProducePage projectId={projectId} episodeId={episodeId} />;
}
