import { createFileRoute } from "@tanstack/react-router";
import { ProjectMemoryPage } from "@/components/memory/ProjectMemoryPage";

export const Route = createFileRoute("/p/$projectId/memory")({
  validateSearch: (search: Record<string, unknown>): { memory?: string } => ({
    memory: typeof search.memory === "string" ? search.memory : undefined,
  }),
  component: MemoryRoute,
});
function MemoryRoute() {
  const { projectId } = Route.useParams();
  const { memory } = Route.useSearch();
  return (
    <ProjectMemoryPage
      key={`${projectId}:${memory ?? ""}`}
      projectId={projectId}
      initialMemoryId={memory}
    />
  );
}
