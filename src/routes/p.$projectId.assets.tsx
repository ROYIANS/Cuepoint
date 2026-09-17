import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/p/$projectId/assets")({
  component: () => <Outlet />,
});
