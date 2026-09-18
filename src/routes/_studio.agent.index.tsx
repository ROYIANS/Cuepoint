import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_studio/agent/")({
  component: AgentChatIndexRoute,
});

/** URL match only — chat UI lives on the `/_studio/agent` layout so it does not remount. */
function AgentChatIndexRoute() {
  return null;
}
