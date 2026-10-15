import {createFileRoute} from "@tanstack/react-router";
import {PropLibraryPage} from "../../features/library/ui/AssetLibraryPages";

export const Route = createFileRoute("/_studio/props/")({
    component: PropLibraryPage,
});
