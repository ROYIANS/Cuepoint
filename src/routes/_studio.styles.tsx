import { createFileRoute } from "@tanstack/react-router";
import { StyleLibraryPage } from "@/components/studio/StyleLibraryPage";

export const Route = createFileRoute("/_studio/styles")({
  component: StyleLibraryPage,
});
