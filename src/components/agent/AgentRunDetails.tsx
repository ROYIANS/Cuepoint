import { useId, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, ChevronDown, Circle, CircleAlert, LoaderCircle, ShieldQuestion, Wrench } from "lucide-react";
import { db } from "@/db/database";
import { canResumeAgentRun } from "@/db/agentTools";
import type { AgentRun, AgentToolCall } from "@/domain/agent";
import { Button } from "@/components/ui/button";

export type RunAction = "resume" | "cancel" | "approve" | "reject";
const STATUS: Record<AgentToolCall["status"], string> = {
  pending: "准备执行", awaiting_approval: "等待批准", approved: "已批准，等待执行",
  running: "执行中", completed: "已完成", failed: "失败", rejected: "已拒绝", unknown: "结果待核实",
};
const EFFECT: Record<AgentToolCall["effect"], string> = {
  read: "读取本地数据", write: "编辑数据", network: "使用互联网", bookkeeping: "更新执行计划",
};

function StepIcon({ status }: { status: AgentToolCall["status"] }) {
  if (status === "completed") return <Check size={15} className="text-green-500" />;
  if (status === "running") return <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" />;
  if (status === "awaiting_approval") return <ShieldQuestion size={15} className="text-amber-500" />;
  if (status === "failed" || status === "unknown") return <CircleAlert size={15} className="text-amber-500" />;
  return <Circle size={15} />;
}

export function AgentRunDetails({ run, busy, onAction }: {
  run: AgentRun;
  busy: boolean;
  onAction: (runId: string, action: RunAction, callId?: string) => void;
}) {
  const calls = useLiveQuery(() => db.agentToolCalls.where("runId").equals(run.id).toArray(), [run.id]);
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const ordered = [...(calls ?? [])].sort((a, b) => a.step - b.step || a.order - b.order);
  const unknown = ordered.some((call) => call.status === "unknown");
  const executing = ordered.some((call) => call.status === "running");
  const pendingApproval = ordered.some((call) => call.status === "awaiting_approval");
  const recoverable = canResumeAgentRun(run);
  const needsAttention = pendingApproval || unknown || recoverable || ordered.some((call) => call.status === "failed");
  const open = expanded || needsAttention;
  if (!run.hasToolCalls && !run.plan?.length) return null;
  const completed = ordered.filter((call) => call.status === "completed").length;
  const label = pendingApproval ? "有操作需要你批准" : unknown ? "有操作结果需要核实" : run.status === "running" ? `正在执行 · ${completed}/${ordered.length} 步` : `已完成 ${completed}/${ordered.length} 步`;
  return (
    <section className="agent-run-activity" aria-label="执行步骤">
      <button type="button" className="agent-run-summary" aria-expanded={open} aria-controls={panelId}
        aria-disabled={needsAttention} onClick={() => { if (!needsAttention) setExpanded(!expanded); }}>
        <Wrench size={15} aria-hidden /><span>{label}</span><ChevronDown size={14} className={open ? "rotate-180" : ""} aria-hidden />
      </button>
      {open && <div id={panelId} className="agent-run-steps">
        {run.plan && run.plan.length > 0 && <ol className="agent-run-plan" aria-label="本次执行计划">
          {run.plan.map((step) => <li key={step.id}>
            <StepIcon status={step.status === "completed" ? "completed" : step.status === "in_progress" ? "running" : "pending"} />
            <span>{step.title}<small>{step.status === "completed" ? "已完成" : step.status === "in_progress" ? "进行中" : "待办"}</small></span>
          </li>)}
        </ol>}
        {ordered.map((call) => <div key={call.id} className="agent-run-step">
          <details open={call.status === "awaiting_approval" || call.status === "failed" || call.status === "unknown" ? true : undefined}>
            <summary><StepIcon status={call.status} /><span>{call.title}</span><small>{STATUS[call.status]}</small><ChevronDown size={12} className="agent-step-chevron" aria-hidden /></summary>
            <div className="agent-step-payload">
              <p>{EFFECT[call.effect]}{call.highRisk ? " · 高风险操作" : ""}</p>
              <div className="agent-step-payload-label">参数</div><pre>{call.arguments}</pre>
              {call.result && <><div className="agent-step-payload-label">返回结果</div><pre>{call.result}</pre></>}
              {call.error && <p className="text-destructive">{call.error}</p>}
            </div>
          </details>
          {call.status === "awaiting_approval" && recoverable && !unknown && !executing && <div className="agent-step-actions">
            <Button size="sm" disabled={busy} onClick={() => onAction(run.id, "approve", call.id)}>批准此次操作</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction(run.id, "reject", call.id)}>拒绝</Button>
          </div>}
        </div>)}
        {unknown && <p role="status" className="text-xs text-amber-500">上次操作的结果尚未确认，为避免重复执行，已暂停自动接续。请先核实已有结果，再结束本次执行。</p>}
        {recoverable && <div className="agent-step-actions">
          {!unknown && !pendingApproval && <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction(run.id, "resume")}>从已保存的步骤继续</Button>}
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => onAction(run.id, "cancel")}>结束本次执行</Button>
        </div>}
      </div>}
    </section>
  );
}
