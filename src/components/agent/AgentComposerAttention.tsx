import { useLiveQuery } from "dexie-react-hooks";
import { ArrowUpRight, CircleAlert } from "lucide-react";
import { db } from "@/db/database";
import type { AgentRun, AgentTask } from "@/domain/agent";
import type { ChatMessage } from "@/domain/types";
import { selectActivityAttention } from "@/lib/agent/activityAttention";
import { getTaskDisplayState } from "@/lib/agent/taskState";
import { useAgentActivityNavigation } from "./AgentActivityNavigation";
import "./composerAttention.css";

export function AgentComposerAttention({ threadId, runs, messages, task, projectUnavailable, onOpenTask }: {
  threadId: string;
  runs: readonly AgentRun[];
  messages: readonly ChatMessage[];
  task?: AgentTask;
  projectUnavailable: boolean;
  onOpenTask: () => void;
}) {
  const { reveal } = useAgentActivityNavigation();
  const state = useLiveQuery(async () => {
    try {
      const [calls, batches, items, jobs, tasks] = await Promise.all([
        db.agentToolCalls.where("threadId").equals(threadId).toArray(),
        db.agentGenerationBatches.where("threadId").equals(threadId).toArray(),
        db.agentGenerationBatchItems.where("threadId").equals(threadId).toArray(),
        db.agentGenerationJobs.where("threadId").equals(threadId).toArray(),
        db.agentTasks.where("threadId").equals(threadId).toArray(),
      ]);
      return { threadId, calls, batches, items, jobs, tasks };
    } catch { return { threadId, error: true as const }; }
  }, [threadId]);
  if (!state || state.threadId !== threadId) return null;
  if ("error" in state) return <p className="agent-attention-read-error" role="alert">待办读取失败，请刷新后检查执行记录。</p>;
  const attention = selectActivityAttention({ ...state, runs, messages, projectUnavailable });
  const taskReview = !projectUnavailable && task?.threadId === threadId && task.lifecycle === "open" && getTaskDisplayState(task, runs) === "review";
  const count = attention.length + (taskReview ? 1 : 0);
  if (!count) return null;
  return <section className="agent-composer-attention" aria-label="待你处理">
    <div className="agent-attention-heading" role="status"><CircleAlert size={14} aria-hidden /><strong>需要你处理</strong>{count > 1 && <span>{count} 项</span>}</div>
    <ul className="agent-attention-list">
      {attention.map(item => <li key={item.id}>
        <div className="agent-attention-copy"><strong>{item.label}</strong><span title={item.detail}>{item.detail}</span></div>
        <button type="button" onClick={() => reveal(item.target)} aria-label={`${item.action}：${item.detail}`}>{item.action}<ArrowUpRight size={12} aria-hidden /></button>
      </li>)}
      {taskReview && <li><div className="agent-attention-copy"><strong>任务待你验收</strong><span title={task.title}>{task.title}</span></div><button type="button" onClick={onOpenTask}>查看并验收<ArrowUpRight size={12} aria-hidden /></button></li>}
    </ul>
  </section>;
}
