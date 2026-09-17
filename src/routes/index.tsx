import { createFileRoute } from "@tanstack/react-router";
import { ProjectListPage } from "@/components/projects/ProjectListPage";

export const Route = createFileRoute("/")({
  component: ProjectListPage,
});
