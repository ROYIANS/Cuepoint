import {createFileRoute} from "@tanstack/react-router";
import {StoryPage} from "../../features/video/ui/StoryPage";

export const Route = createFileRoute("/p/$projectId/e/$episodeId/")({
    component: EpisodeStoryRoute,
});

function EpisodeStoryRoute() {
    const {projectId, episodeId} = Route.useParams();
    return <StoryPage key={episodeId} projectId={projectId} episodeId={episodeId}/>;
}
