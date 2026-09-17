import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/p/$projectId/plan")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/p/$projectId/produce", params });
  },
});
