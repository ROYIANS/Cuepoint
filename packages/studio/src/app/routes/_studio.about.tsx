import {createFileRoute} from "@tanstack/react-router";
import {AboutPage} from "../../features/settings/ui/AboutPage";

export const Route = createFileRoute("/_studio/about")({
    component: AboutPage,
});
