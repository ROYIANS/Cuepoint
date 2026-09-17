import { createFileRoute } from "@tanstack/react-router";
import { SceneDetailPage } from "@/components/assets/SceneDetailPage";

export const Route = createFileRoute("/_studio/scenes/$sceneId")({
  component: SceneStudioRoute,
});

function SceneStudioRoute() {
  const { sceneId } = Route.useParams();
  return <SceneDetailPage sceneId={sceneId} back={{ kind: "studio" }} />;
}
