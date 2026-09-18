import { createFileRoute, useParams, useLocation } from "@tanstack/react-router";
import { AgentChatPage } from "@/components/agent/AgentChatPage";
import { LobeChatTheme } from "@/components/agent/LobeChatTheme";

export const Route = createFileRoute("/_studio/agent")({
  component: AgentChatLayout,
});

function AgentChatLayout() {
  const location = useLocation();
  const params = useParams({ strict: false });
  const threadId = typeof params.threadId === "string" ? params.threadId : undefined;
  return (
    <LobeChatTheme>
      <AgentChatPage threadId={threadId} view={location.pathname === "/agent/tasks" ? "tasks" : undefined} />
    </LobeChatTheme>
  );
}
