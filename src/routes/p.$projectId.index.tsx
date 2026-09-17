import { createFileRoute } from "@tanstack/react-router";
import { EpisodeListPage } from "@/components/workspace/EpisodeListPage";

export const Route = createFileRoute("/p/$projectId/")({
  component: SeriesHomeRoute,
});

function SeriesHomeRoute() {
  const { projectId } = Route.useParams();
  return <EpisodeListPage key={projectId} projectId={projectId} />;
}
