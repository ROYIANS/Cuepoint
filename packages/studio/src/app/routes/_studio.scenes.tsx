import {createFileRoute, Outlet} from "@tanstack/react-router";

export const Route = createFileRoute("/_studio/scenes")({
    component: () => <Outlet/>,
});
