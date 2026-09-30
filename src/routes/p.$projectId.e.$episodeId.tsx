import {createFileRoute, Outlet} from "@tanstack/react-router";

export const Route = createFileRoute("/p/$projectId/e/$episodeId")({
    component: EpisodeLayout,
});

function EpisodeLayout() {
    return <Outlet/>;
}
