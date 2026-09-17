import { createFileRoute } from "@tanstack/react-router";
import { PropLibraryPage } from "@/components/studio/PropLibraryPage";

export const Route = createFileRoute("/_studio/props")({
  component: PropLibraryPage,
});
