import { createFileRoute } from "@tanstack/react-router";
import { StyleDetailPage } from "@/components/assets/StyleDetailPage";

export const Route = createFileRoute("/_studio/styles/$styleId")({
  component: StyleStudioRoute,
});

function StyleStudioRoute() {
  const { styleId } = Route.useParams();
  return <StyleDetailPage styleId={styleId} />;
}
