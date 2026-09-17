import { createFileRoute } from "@tanstack/react-router";
import { AssetLibraryPage } from "@/components/assets/AssetLibraryPage";

export const Route = createFileRoute("/p/$projectId/assets/")({
  component: AssetsIndexRoute,
});

function AssetsIndexRoute() {
  const { projectId } = Route.useParams();
  return <AssetLibraryPage projectId={projectId} />;
}
