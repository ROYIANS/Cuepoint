import {createFileRoute} from "@tanstack/react-router";
import {AssetLibraryPage} from "../../features/library/ui/AssetLibraryPage";

import {parseWorldTab, type WorldTab} from "../../features/library/queries/assetLibrary";

export const Route = createFileRoute("/p/$projectId/world")({
    validateSearch: (search: Record<string, unknown>): { tab?: WorldTab } => ({tab: parseWorldTab(search.tab)}),
    component: WorldRoute,
});

function WorldRoute() {
    const {projectId} = Route.useParams();
    const {tab} = Route.useSearch();
    const navigate = Route.useNavigate();
    return <AssetLibraryPage projectId={projectId} tab={tab ?? "setting"}
                             onTabChange={(next) => void navigate({search: {tab: next}, replace: true})}/>;
}
