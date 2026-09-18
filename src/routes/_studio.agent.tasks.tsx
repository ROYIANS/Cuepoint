import { createFileRoute } from "@tanstack/react-router";

// The parent keeps the shared conversation runtime mounted across navigation.
export const Route = createFileRoute("/_studio/agent/tasks")({ component: () => null });
