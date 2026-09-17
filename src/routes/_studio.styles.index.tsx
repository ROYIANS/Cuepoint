import { createFileRoute } from "@tanstack/react-router";
import { StyleLibraryPage } from "@/components/studio/AssetLibraryPages";

export const Route = createFileRoute("/_studio/styles/")({
  component: StyleLibraryPage,
});
