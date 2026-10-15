import {createFileRoute} from "@tanstack/react-router";
import {CharacterLibraryPage} from "../../features/library/ui/AssetLibraryPages";

export const Route = createFileRoute("/_studio/characters/")({
    component: CharacterLibraryPage,
});
