import { createFileRoute } from "@tanstack/react-router";
import { CharacterLibraryPage } from "@/components/studio/AssetLibraryPages";

export const Route = createFileRoute("/_studio/characters")({
  component: CharacterLibraryPage,
});
