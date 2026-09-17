import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceChrome } from "@/components/workspace/WorkspaceChrome";

export const Route = createFileRoute("/p/$projectId")({
  component: WorkspaceRoute,
});

function WorkspaceRoute() {
  const { projectId } = Route.useParams();
  return <WorkspaceChrome projectId={projectId} />;
}
