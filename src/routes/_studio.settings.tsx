import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_studio/settings")({
  beforeLoad: () => {
    throw redirect({ to: "/about", replace: true });
  },
});
