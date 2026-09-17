import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/p/$projectId/report")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/p/$projectId/produce", params });
  },
});
