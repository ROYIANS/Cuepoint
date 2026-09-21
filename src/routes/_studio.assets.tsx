import { createFileRoute } from "@tanstack/react-router";
import { AssetsHubPage } from "@/components/studio/StudioHubPages";

export const Route = createFileRoute("/_studio/assets")({ component: AssetsHubPage });
