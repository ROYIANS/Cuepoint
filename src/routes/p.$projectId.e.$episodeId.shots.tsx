import { createFileRoute } from "@tanstack/react-router";
import { ShotEditorPage } from "@/components/shots/ShotEditorPage";

export const Route = createFileRoute("/p/$projectId/e/$episodeId/shots")({
  component: EpisodeShotsRoute,
});

function EpisodeShotsRoute() {
  const { projectId, episodeId } = Route.useParams();
  return <ShotEditorPage projectId={projectId} episodeId={episodeId} />;
}
