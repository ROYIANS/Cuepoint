import { createFileRoute } from "@tanstack/react-router";
import { StoryPage } from "@/components/story/StoryPage";

export const Route = createFileRoute("/p/$projectId/")({
  component: StoryRoute,
});

function StoryRoute() {
  const { projectId } = Route.useParams();
  return <StoryPage key={projectId} projectId={projectId} />;
}
