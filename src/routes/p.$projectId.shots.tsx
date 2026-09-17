import { createFileRoute } from "@tanstack/react-router";
import { ShotEditorPage } from "@/components/shots/ShotEditorPage";

export const Route = createFileRoute("/p/$projectId/shots")({
  component: ShotsRoute,
});

function ShotsRoute() {
  const { projectId } = Route.useParams();
  return <ShotEditorPage projectId={projectId} />;
}
