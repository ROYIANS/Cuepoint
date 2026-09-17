import { createFileRoute } from "@tanstack/react-router";
import { PropDetailPage } from "@/components/assets/PropDetailPage";

export const Route = createFileRoute("/_studio/props/$propId")({
  component: PropStudioRoute,
});

function PropStudioRoute() {
  const { propId } = Route.useParams();
  return <PropDetailPage propId={propId} />;
}
