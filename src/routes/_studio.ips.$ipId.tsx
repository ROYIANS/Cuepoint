import { createFileRoute } from "@tanstack/react-router";
import { IpProfilePage } from "@/components/studio/IpProfilesPage";

export const Route = createFileRoute("/_studio/ips/$ipId")({ component: IpDetailRoute });

function IpDetailRoute() {
  const { ipId } = Route.useParams();
  return <IpProfilePage key={ipId} ipId={ipId} />;
}
