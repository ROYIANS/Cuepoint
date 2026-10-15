import {createFileRoute} from "@tanstack/react-router";
import {SceneDetailPage} from "../../features/library/ui/SceneDetailPage";

export const Route = createFileRoute("/p/$projectId/assets/scenes/$sceneId")({
    component: SceneRoute,
});

function SceneRoute() {
    const {projectId, sceneId} = Route.useParams();
    return <SceneDetailPage sceneId={sceneId} back={{kind: "project", projectId}}/>;
}
