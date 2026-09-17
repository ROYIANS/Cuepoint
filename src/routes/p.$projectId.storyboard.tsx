import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/p/$projectId/storyboard")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/p/$projectId", params });
  },
});
