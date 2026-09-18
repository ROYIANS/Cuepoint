import { createFileRoute } from "@tanstack/react-router";
import { AboutPage } from "@/components/studio/AboutPage";

export const Route = createFileRoute("/_studio/about")({
  component: AboutPage,
});
