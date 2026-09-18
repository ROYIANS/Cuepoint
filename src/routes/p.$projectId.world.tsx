import { createFileRoute } from "@tanstack/react-router";
import { AssetLibraryPage } from "@/components/assets/AssetLibraryPage";

import { parseWorldTab, type WorldTab } from "@/lib/assetLibrary";

export const Route = createFileRoute("/p/$projectId/world")({
  validateSearch: (search: Record<string, unknown>): { tab?: WorldTab } => ({ tab: parseWorldTab(search.tab) }),
  component: WorldRoute,
});

function WorldRoute() {
  const { projectId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  return <AssetLibraryPage projectId={projectId} tab={tab ?? "setting"}
    onTabChange={(next) => void navigate({ search: { tab: next }, replace: true })} />;
}
