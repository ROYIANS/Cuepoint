import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/workspace/WorkspaceChrome";

export const Route = createFileRoute("/p/$projectId/report")({
  component: () => (
    <PlaceholderPage
      title="拍摄报告"
      detail="拍摄报告尚未设计，先作为流程示意占位。"
    />
  ),
});
