import {createFileRoute} from "@tanstack/react-router";
import {ProjectHomePage} from "@/components/workspace/ProjectHomePage";

export const Route = createFileRoute("/p/$projectId/")({component: ProjectHomeRoute});

function ProjectHomeRoute() {
    const {projectId} = Route.useParams();
    return <ProjectHomePage key={projectId} projectId={projectId}/>;
}
