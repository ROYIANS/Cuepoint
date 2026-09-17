import { createFileRoute } from "@tanstack/react-router";
import { StoryboardPrintPage } from "@/components/produce/StoryboardPrintPage";

export const Route = createFileRoute("/p/$projectId/e/$episodeId/storyboard")({
  component: EpisodeStoryboardRoute,
});

function EpisodeStoryboardRoute() {
  const { projectId, episodeId } = Route.useParams();
  return <StoryboardPrintPage projectId={projectId} episodeId={episodeId} />;
}
