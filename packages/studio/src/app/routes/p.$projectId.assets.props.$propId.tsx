import {createFileRoute} from "@tanstack/react-router";
import {PropDetailPage} from "../../features/library/ui/PropDetailPage";

export const Route = createFileRoute("/p/$projectId/assets/props/$propId")({
    component: PropRoute,
});

function PropRoute() {
    const {projectId, propId} = Route.useParams();
    return <PropDetailPage propId={propId} back={{kind: "project", projectId}}/>;
}
