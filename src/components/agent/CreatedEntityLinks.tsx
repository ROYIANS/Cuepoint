import { Link } from "@tanstack/react-router";
import type { AgentToolCall } from "@/domain/agent";

export function CreatedEntityLinks({ call, includePreview = false }: { call: AgentToolCall; includePreview?: boolean }) {
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
  return <div className="agent-change-results">{[...links].map(([href, label]) => <Link key={href} to={href} className="agent-change-link">查看{label} ↗</Link>)}</div>;
}
