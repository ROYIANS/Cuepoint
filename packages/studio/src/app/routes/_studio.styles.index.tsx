import {createFileRoute} from "@tanstack/react-router";
import {StyleLibraryPage} from "../../features/library/ui/AssetLibraryPages";

export const Route = createFileRoute("/_studio/styles/")({
    component: StyleLibraryPage,
});
