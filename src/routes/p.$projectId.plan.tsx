import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/workspace/WorkspaceChrome";

export const Route = createFileRoute("/p/$projectId/plan")({
  component: () => (
    <PlaceholderPage
      title="拍摄计划"
      detail="拍摄计划尚未设计，先作为流程示意占位。"
    />
  ),
});
