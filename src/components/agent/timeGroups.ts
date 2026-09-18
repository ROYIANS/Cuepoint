import type { ChatThread } from "@/domain/types";

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function monthLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString("zh-CN", { month: "long" });
  }
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "long" });
}

/** Mirrors lobehub topic `groupTitle.byTime` — 今天 / 昨天 / 六月. */
export function groupThreadsByTime(
  threads: ChatThread[],
): Array<{ label: string; threads: ChatThread[] }> {
  const now = new Date();
  const today = startOfDay(now.getTime());
  const yesterday = today - 86_400_000;
  const map = new Map<string, ChatThread[]>();
  const order: string[] = [];

  const push = (label: string, thread: ChatThread) => {
    const list = map.get(label);
    if (list) {
      list.push(thread);
      return;
    }
    map.set(label, [thread]);
    order.push(label);
  };

  for (const thread of threads) {
    const day = startOfDay(new Date(thread.updatedAt).getTime());
    if (day >= today) push("今天", thread);
    else if (day >= yesterday) push("昨天", thread);
    else push(monthLabel(thread.updatedAt, now), thread);
  }

  return order.map((label) => ({ label, threads: map.get(label) ?? [] }));
}

export function formatRelative(iso: string): string {
  const ts = new Date(iso).getTime();
  const diff = Date.now() - ts;
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return new Date(iso).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}
