import { createFileRoute } from "@tanstack/react-router";
import { SceneLibraryPage } from "@/components/studio/AssetLibraryPages";

export const Route = createFileRoute("/_studio/scenes")({
  component: SceneLibraryPage,
});
