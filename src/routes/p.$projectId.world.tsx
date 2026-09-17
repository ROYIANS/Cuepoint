import { createFileRoute } from "@tanstack/react-router";
import { AssetLibraryPage } from "@/components/assets/AssetLibraryPage";

export const Route = createFileRoute("/p/$projectId/world")({
  component: WorldRoute,
});

function WorldRoute() {
  const { projectId } = Route.useParams();
  return <AssetLibraryPage projectId={projectId} />;
}
