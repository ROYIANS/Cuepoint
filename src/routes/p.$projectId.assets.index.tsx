import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/p/$projectId/assets/")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/p/$projectId/world", params });
  },
});
