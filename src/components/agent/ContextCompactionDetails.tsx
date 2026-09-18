import { Check, ChevronDown, LoaderCircle, TriangleAlert } from "lucide-react";
import type { ContextCompaction } from "@/domain/context";
import { formatTokenCount } from "@/lib/agent/contextUsage";

export function ContextCompactionDetails({ record }: { record: ContextCompaction }) {
  const running = record.status === "running", done = record.status === "completed";
  const Icon = running ? LoaderCircle : done ? Check : TriangleAlert;
  return <details className="agent-compaction">
    <summary><Icon size={14} className={running ? "animate-spin" : undefined} />{running ? "正在整理较早的对话" : done ? "历史已整理" : record.status === "interrupted" ? "整理已中断" : "整理未完成"}<span>{record.coverage.length} 条</span><ChevronDown size={12} /></summary>
    <div className="agent-compaction-body">
      <p>{done ? `摘要已保存，约 ${formatTokenCount(record.beforeTokens)} → ${formatTokenCount(record.afterTokens ?? 0)} tokens；原始消息仍可在对话中查看。` : running ? "完成后自动接续回复。可通过输入框的停止按钮中断，未完成的摘要不会生效。" : `${record.error ?? "原始对话已保留。"} 使用回复上的重新生成或执行步骤中的继续操作重试。`}</p>
      {record.usage?.totalTokens !== undefined && <p>整理用量：{formatTokenCount(record.usage.totalTokens)} tokens · 与回复用量分开统计</p>}
      {done && <pre>{record.content}</pre>}
      <details className="agent-compaction-source"><summary>查看摘要覆盖的原始消息</summary>{record.coverage.map((message) => <div key={message.id}><p>{message.role === "user" ? "你" : message.role === "assistant" ? "助手" : "系统"}</p><pre>{message.content}</pre></div>)}</details>
    </div>
  </details>;
}
