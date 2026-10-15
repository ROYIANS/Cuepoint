import {createFileRoute} from "@tanstack/react-router";
import {SceneLibraryPage} from "../../features/library/ui/AssetLibraryPages";

export const Route = createFileRoute("/_studio/scenes/")({
    component: SceneLibraryPage,
});
