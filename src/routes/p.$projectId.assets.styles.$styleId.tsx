import { createFileRoute } from "@tanstack/react-router";
import { StyleDetailPage } from "@/components/assets/StyleDetailPage";

export const Route = createFileRoute("/p/$projectId/assets/styles/$styleId")({
  component: StyleRoute,
});

function StyleRoute() {
  const { projectId, styleId } = Route.useParams();
  return <StyleDetailPage styleId={styleId} back={{ kind: "project", projectId }} />;
}
