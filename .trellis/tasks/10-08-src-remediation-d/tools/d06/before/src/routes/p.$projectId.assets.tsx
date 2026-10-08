import {createFileRoute, Outlet} from "@tanstack/react-router";

export const Route = createFileRoute("/p/$projectId/assets")({
    component: () => <Outlet/>,
});
