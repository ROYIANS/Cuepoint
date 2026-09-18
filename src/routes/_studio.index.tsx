import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_studio/")({
  beforeLoad: () => {
    throw redirect({ to: "/agent" });
  },
});
