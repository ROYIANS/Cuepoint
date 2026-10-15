import {createFileRoute} from "@tanstack/react-router";
import {ProjectGalleryPage} from "../../features/projects/ui/ProjectGalleryPage";

export const Route = createFileRoute("/_studio/projects")({
    component: ProjectGalleryPage,
});
