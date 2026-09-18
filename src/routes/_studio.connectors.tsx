import { createFileRoute } from "@tanstack/react-router";
import { ConnectorsPage } from "@/components/studio/ConnectorsPage";

export const Route = createFileRoute("/_studio/connectors")({
  component: ConnectorsPage,
});
