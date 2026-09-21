import { createFileRoute } from "@tanstack/react-router";
import { IpProfilesPage } from "@/components/studio/IpProfilesPage";

export const Route = createFileRoute("/_studio/ips/")({ component: IpProfilesPage });
