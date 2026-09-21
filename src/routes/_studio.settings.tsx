import { createFileRoute } from "@tanstack/react-router";
import { SettingsHelpPage } from "@/components/studio/StudioHubPages";

export const Route = createFileRoute("/_studio/settings")({ component: SettingsHelpPage });
