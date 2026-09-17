import { createFileRoute } from "@tanstack/react-router";
import { ShotEditorPage } from "@/components/shots/ShotEditorPage";

export const Route = createFileRoute("/p/$projectId/e/$episodeId/shots")({
  validateSearch: (search: Record<string, unknown>) => ({
    shot: typeof search.shot === "string" ? search.shot : undefined,
  }),
  component: EpisodeShotsRoute,
});

function EpisodeShotsRoute() {
  const { projectId, episodeId } = Route.useParams();
  const { shot } = Route.useSearch();
  return <ShotEditorPage projectId={projectId} episodeId={episodeId} focusShotId={shot} />;
}
