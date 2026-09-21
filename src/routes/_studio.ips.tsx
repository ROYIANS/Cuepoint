import { createFileRoute } from "@tanstack/react-router";
import { IpHomePage } from "@/components/studio/StudioHubPages";

export const Route = createFileRoute("/_studio/ips")({ component: IpHomePage });
