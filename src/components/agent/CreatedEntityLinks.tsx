import { Link, useNavigate } from "@tanstack/react-router";
import type { AgentToolCall } from "@/domain/agent";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createChatThread } from "@/db/repo";
import { db } from "@/db/database";

function ProjectConversationButton({ projectId, sourceThreadId }: { projectId: string; sourceThreadId: string }) {
  const navigate = useNavigate();
  const lock = useRef(false);
  const destination = useRef<string | undefined>(undefined);
  const [pending, setPending] = useState(false);
  async function open() {
    if (lock.current) return;
    lock.current = true; setPending(true);
    try {
      if (!destination.current) {
        const source = await db.chatThreads.get(sourceThreadId);
        const thread = await createChatThread({ projectId, connectorId: source?.connectorId, model: source?.model });
        destination.current = thread.id;
      }
      await navigate({ to: "/agent/$threadId", params: { threadId: destination.current } });
    } catch (error) { toast.error(error instanceof Error ? error.message : "无法开启项目对话"); }
    finally { lock.current = false; setPending(false); }
  }
  return <Button size="sm" variant="outline" disabled={pending} onClick={() => void open()}>{pending ? "正在打开…" : "在此项目继续创作"}</Button>;
}

export function CreatedEntityLinks({ call, includePreview = false, allowProjectConversation = false }: { call: AgentToolCall; includePreview?: boolean; allowProjectConversation?: boolean }) {
  if (call.status !== "completed" || call.effect !== "write" || !call.result) return null;
  let result: unknown;
  try { result = JSON.parse(call.result); } catch { return null; }
  if (!result || typeof result !== "object") return null;
  const items = "items" in result && Array.isArray(result.items) ? result.items : [result];
  const links = new Map<string, string>();
  for (const item of items.slice(0, 20)) {
    if (!item || typeof item !== "object" || !("target" in item)) continue;
    const target = item.target;
    if (!target || typeof target !== "object" || !("href" in target) || !("label" in target)) continue;
    if (typeof target.href !== "string" || !/^\/(?!\/)/.test(target.href) || typeof target.label !== "string") continue;
    if (includePreview || target.href !== call.preview?.target?.href) links.set(target.href, target.label);
  }
  if (!links.size) return null;
  const createdProjectId = allowProjectConversation && call.name === "project_create" && "id" in result && typeof result.id === "string" && links.has(`/p/${encodeURIComponent(result.id)}`) ? result.id : undefined;
  return <div className="agent-change-results">{[...links].map(([href, label]) => <Link key={href} to={href} className="agent-change-link">查看{label} ↗</Link>)}{createdProjectId && <ProjectConversationButton key={createdProjectId} projectId={createdProjectId} sourceThreadId={call.threadId} />}</div>;
}
