import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_studio/agent/$threadId")({
  component: AgentChatThreadRoute,
});

/** URL match only — chat UI lives on the `/_studio/agent` layout so it does not remount. */
function AgentChatThreadRoute() {
  return null;
}
