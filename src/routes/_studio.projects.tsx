import { createFileRoute } from "@tanstack/react-router";
import { ProjectGalleryPage } from "@/components/studio/ProjectGalleryPage";

export const Route = createFileRoute("/_studio/projects")({
  component: ProjectGalleryPage,
});
