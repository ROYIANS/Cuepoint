import { createFileRoute } from "@tanstack/react-router";
import { SceneDetailPage } from "@/components/assets/SceneDetailPage";

export const Route = createFileRoute("/p/$projectId/assets/scenes/$sceneId")({
  component: SceneRoute,
});

function SceneRoute() {
  const { projectId, sceneId } = Route.useParams();
  return <SceneDetailPage projectId={projectId} sceneId={sceneId} />;
}
