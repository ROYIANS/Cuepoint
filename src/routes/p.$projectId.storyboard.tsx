import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/workspace/WorkspaceChrome";

export const Route = createFileRoute("/p/$projectId/storyboard")({
  component: () => (
    <PlaceholderPage
      title="故事板"
      detail="这一步还没定具体交互。镜头数据都在「分镜制作」里，这里先占位。"
    />
  ),
});
