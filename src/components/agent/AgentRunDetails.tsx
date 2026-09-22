import { CreatedEntityLinks } from "./CreatedEntityLinks";
import { AgentWriteOutcomes } from "./AgentWriteOutcomes";
import { WebResearchSources } from "./WebResearchSources";
import { ProjectImageSources } from "./ProjectImageSources";
import { GenerationReview } from "./GenerationReview";
import { AgentGenerationResults } from "./AgentGenerationResults";
import { Link } from "@tanstack/react-router";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Markdown } from "@lobehub/ui";
import { Check, ChevronDown, Circle, CircleAlert, LoaderCircle, ShieldQuestion, Wrench } from "lucide-react";
import { canResumeAgentRun } from "@/db/agentTools";
import type { AgentRun, AgentToolCall } from "@/domain/agent";
import { MODEL_STEPS_PER_SEGMENT } from "@/domain/agent";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/domain/types";
import { buildRunActivity, formatRunElapsed, getRunElapsedMs, isPersistedToolRound } from "@/lib/agent/runPresentation";
import { readToolValidationFailure, type ToolValidationFailure } from "@/lib/agent/toolErrors";
import { describeRunExecution } from "@/lib/agent/executionSummary";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThinkingPanel } from "./ThinkingPanel";
import { useAgentActivityNavigation } from "./AgentActivityNavigation";
import "./executionActivity.css";

const MARKDOWN_PROPS = { variant: "chat" } as const;

export type RunAction = "resume" | "cancel" | "approve" | "reject";
const STATUS: Record<AgentToolCall["status"], string> = {
  pending: "准备执行", awaiting_approval: "等待批准", approved: "已批准，等待执行",
  running: "执行中", completed: "已完成", failed: "失败", rejected: "已拒绝", unknown: "结果待核实",
};
const EFFECT: Record<AgentToolCall["effect"], string> = {
  read: "读取本地数据", write: "编辑数据", network: "使用互联网", bookkeeping: "维护任务与计划",
};

function StepIcon({ status }: { status: AgentToolCall["status"] }) {
  if (status === "completed") return <Check size={15} className="text-green-500" />;
  if (status === "running") return <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" />;
  if (status === "awaiting_approval") return <ShieldQuestion size={15} className="text-amber-500" />;
  if (status === "failed" || status === "unknown") return <CircleAlert size={15} className="text-amber-500" />;
  return <Circle size={15} />;
}

/** Only this tiny label ticks; historical markdown never rerenders for the clock. */
function RunElapsed({ run }: { run: AgentRun }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (run.status !== "running") return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [run.status]);
  return <span title="本轮经过时间，包含等待确认的时间">用时 {formatRunElapsed(getRunElapsedMs(run, now))}</span>;
}

function validationFailure(call: AgentToolCall): ToolValidationFailure | undefined {
  if (call.status !== "failed") return undefined;
  return readToolValidationFailure(call.result);
}

function ValidationFailureNotice({ failure, legacy }: { failure: ToolValidationFailure; legacy?: boolean }) {
  return <div className="agent-tool-validation-error" role="alert">
    <strong>参数校验失败，操作未执行</strong>
    {legacy && <p className="agent-tool-validation-legacy">历史记录补充：按当前工具规则复核，以下诊断不代表当时返回内容。</p>}
    <ul>{failure.issues.map((issue, index) => <li key={`${issue.path}-${index}`}><code>{issue.path}</code>：{issue.constraint}{issue.received !== undefined && <span>（收到 {String(issue.received)}）</span>}</li>)}</ul>
    <p className="agent-tool-validation-recovery">
      此次操作未执行，也未产生结果。助手应修正上述参数后重新调用；若依据其他资料回答，需要说明缺失信息对结论的影响。
      {failure.issues.some((issue) => /limit|offset/i.test(issue.path)) && " 如需读取较长内容，请按 nextOffset 分页读取，每次请求保持在单次上限内。"}
    </p>
  </div>;
}

function ToolCallRow({ run, call, busy, readOnly, unknown, executing, onAction }: {
  run: AgentRun; call: AgentToolCall; busy: boolean; readOnly?: boolean;
  unknown: boolean; executing: boolean;
  onAction: (runId: string, action: RunAction, callId?: string) => void;
}) {
  const { request } = useAgentActivityNavigation();
  const [open, setOpen] = useState(call.status === "awaiting_approval" || call.status === "unknown");
  const panelId = useId();
  useEffect(() => {
    if (request?.runId === run.id && request.callId === call.id) setOpen(true);
  }, [request, run.id, call.id]);
  const recoverable = canResumeAgentRun(run);
  const reviewGeneration = !readOnly && call.name === "submit_generation" && call.status === "awaiting_approval" && recoverable && !unknown && !executing;
  const preview = call.generationOverride?.preview ?? call.preview;
  const [legacyValidation, setLegacyValidation] = useState<ToolValidationFailure | undefined>();
  const structuredValidation = useMemo(() => validationFailure(call), [call.status, call.result]);
  useEffect(() => {
    let cancelled = false;
    if (!structuredValidation && call.status === "failed" && call.error?.includes("参数无效")) {
      void import("@/lib/agent/tools").then(({ getLegacyToolValidationFailure }) => {
        if (!cancelled) setLegacyValidation(getLegacyToolValidationFailure(call));
      });
    } else setLegacyValidation(undefined);
    return () => { cancelled = true; };
  }, [call, structuredValidation]);
  const validation = structuredValidation ?? legacyValidation;
  const isLegacyValidation = !structuredValidation && Boolean(legacyValidation);
  return <div className="agent-run-step" data-activity-call={call.id}>
    <button type="button" className="agent-tool-call-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}>
      <StepIcon status={call.status} /><span>{call.title}</span><small>{STATUS[call.status]}</small><ChevronDown size={12} className={open ? "rotate-180" : ""} aria-hidden />
    </button>
    <div id={panelId} hidden={!open}>
      <div className="agent-step-payload">
        <p>{EFFECT[call.effect]}{validation ? " · 未执行" : call.highRisk ? " · 高风险操作" : ""}</p>
        {validation && <ValidationFailureNotice failure={validation} legacy={isLegacyValidation} />}
        {reviewGeneration ? <GenerationReview call={call} busy={busy} onAction={onAction} /> : preview && <div className="agent-change-preview">
          <strong>{preview.summary}</strong>
          {preview.changes.length > 0 && <ul>{preview.changes.map((change, index) => <li key={index}>{change}</li>)}</ul>}
          {preview.target && /^\/(?!\/)/.test(preview.target.href) && <Link to={preview.target.href} className="agent-change-link">查看{preview.target.label} ↗</Link>}
        </div>}
        <WebResearchSources call={call} />
        <ProjectImageSources call={call} />
        <details className="agent-step-technical">
          <summary>参数与返回结果</summary>
          <div className="agent-step-payload-label">AI 原始参数</div><pre>{call.arguments}</pre>
          {call.generationOverride && <><div className="agent-step-payload-label">用户确认的参数</div><pre>{call.generationOverride.arguments}</pre></>}
          {call.result && <><div className="agent-step-payload-label">返回结果</div><pre>{call.result}</pre></>}
        </details>
        {call.error && !validation && <p className="text-destructive">{call.error}</p>}
      </div>
      {call.name !== "project_create" && <CreatedEntityLinks call={call} />}
      {!readOnly && !reviewGeneration && call.status === "awaiting_approval" && recoverable && !unknown && !executing && <div className="agent-step-actions">
        <Button size="sm" disabled={busy} onClick={() => onAction(run.id, "approve", call.id)}>批准此次操作</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction(run.id, "reject", call.id)}>拒绝</Button>
      </div>}
    </div>
    {call.name === "project_create" && <CreatedEntityLinks call={call} allowProjectConversation={!readOnly} />}
  </div>;
}

function ToolGroup({ calls, ...props }: Omit<Parameters<typeof ToolCallRow>[0], "call"> & { calls: AgentToolCall[] }) {
  const { request } = useAgentActivityNavigation();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const handledRequest = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (request?.runId === props.run.id && request.callId && calls.some((call) => call.id === request.callId) && handledRequest.current !== request.key) {
      handledRequest.current = request.key;
      setOpen(true);
    }
  }, [request, props.run.id, calls]);
  const running = calls.some((call) => call.status === "running");
  const attention = calls.some((call) => call.status === "awaiting_approval" || call.status === "unknown");
  const failed = calls.filter((call) => call.status === "failed").length;
  const titles = [...new Set(calls.map((call) => call.title))];
  const label = titles.slice(0, 2).join("、") + (titles.length > 2 ? "等" : "");
  return <div className="agent-tool-group">
    <button type="button" className="agent-tool-group-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}>
      {running ? <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Wrench size={14} aria-hidden />}
      <span>{label}</span><small>{calls.length} 项{attention ? " · 待处理" : failed ? ` · 含 ${failed} 项失败` : running ? " · 执行中" : ""}</small><ChevronDown size={12} className={open ? "rotate-180" : ""} aria-hidden />
    </button>
    <div id={panelId} className="agent-tool-group-calls" hidden={!open}>
      {calls.map((call) => <ToolCallRow key={call.id} {...props} call={call} />)}
    </div>
  </div>;
}

export function AgentRunDetails({ run, message, calls, busy, readOnly, onAction }: {
  run: AgentRun; message: ChatMessage; calls: AgentToolCall[];
  busy: boolean; readOnly?: boolean;
  onAction: (runId: string, action: RunAction, callId?: string) => void;
}) {
  const { request } = useAgentActivityNavigation();
  const [expanded, setExpanded] = useState(run.status === "running");
  const [hasExpanded, setHasExpanded] = useState(run.status === "running");
  const previousStatus = useRef(run.status);
  const sectionRef = useRef<HTMLElement>(null);
  const positionedRequest = useRef<number | undefined>(undefined);
  const panelId = useId();
  const ownedCalls = useMemo(() => calls.filter((call) => call.runId === run.id && call.threadId === run.threadId), [run.id, run.threadId, calls]);
  const activity = useMemo(() => buildRunActivity(run, ownedCalls), [run, ownedCalls]);
  const unknown = ownedCalls.some((call) => call.status === "unknown");
  const executing = ownedCalls.some((call) => call.status === "running");
  const pendingApproval = ownedCalls.some((call) => call.status === "awaiting_approval");
  const recoverable = canResumeAgentRun(run);
  const persisted = isPersistedToolRound(run, message, ownedCalls);
  const currentReasoning = persisted ? "" : message.reasoning?.trim();
  const currentContent = run.status === "running" && !persisted ? message.content : "";
  const reasoningActive = run.status === "running" && !!currentReasoning && !currentContent;
  const budgetPaused = run.status === "interrupted" && run.pauseReason === "model_step_limit";
  const failedCount = ownedCalls.filter((call) => call.status === "failed").length;
  const execution = useMemo(() => describeRunExecution(run, ownedCalls), [run, ownedCalls]);
  const missingLedger = Boolean(run.hasToolCalls && !ownedCalls.length);

  useEffect(() => { if (expanded) setHasExpanded(true); }, [expanded]);

  useEffect(() => {
    if (previousStatus.current !== run.status) {
      // Transition only: database updates must never undo a manual toggle.
      if (run.status === "running") setExpanded(true);
      else if (["completed", "cancelled", "failed", "interrupted"].includes(run.status)) setExpanded(false);
      previousStatus.current = run.status;
    }
  }, [run.status]);

  useEffect(() => {
    if (request?.runId !== run.id || positionedRequest.current === request.key) return;
    setExpanded(true);
    if (request.callId && !calls.some((call) => call.id === request.callId)) return;
    const frame = requestAnimationFrame(() => {
      const section = sectionRef.current;
      if (!section) return;
      positionedRequest.current = request.key;
      const target = request.callId
        ? [...section.querySelectorAll<HTMLElement>("[data-activity-call]")].find((element) => element.dataset.activityCall === request.callId) ?? section
        : section;
      const list = section.closest<HTMLElement>(".agent-message-list");
      if (list) list.scrollTop += target.getBoundingClientRect().top - list.getBoundingClientRect().top - 64;
      // Batch dialog manages its own focus. Approval/recovery navigation focuses the visible control.
      if (!request.batchId) target.querySelector<HTMLElement>("button:not([disabled])")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [request, run.id, calls]);

  return <section ref={sectionRef} className="agent-run-activity agent-execution-activity" aria-label="执行过程" data-activity-run={run.id}>
    <Button variant="ghost" className="agent-run-summary agent-execution-summary h-auto justify-start rounded-none" aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpanded((value) => !value)}>
      <RunElapsed run={run} /><ChevronDown size={14} className={expanded ? "rotate-180" : ""} aria-hidden />
      <small>{execution.label}</small>
      {failedCount > 0 && <small className="agent-execution-failure-summary">含 {failedCount} 项失败</small>}
    </Button>
    <AgentWriteOutcomes run={run} calls={ownedCalls} />
    <div id={panelId} className="agent-execution-timeline" hidden={!expanded}>
      {(expanded || hasExpanded) && <>
      <div className="agent-execution-explanation">
        <p>{execution.detail}</p>
        <Popover><PopoverTrigger asChild><Button variant="ghost" size="sm" className="h-auto px-0 py-1 text-xs text-muted-foreground">执行记录</Button></PopoverTrigger>
          <PopoverContent align="start" className="w-72 text-xs">
            <p className="mb-3 text-muted-foreground">以下为本次执行记录，不代表作品已制作完成。</p>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
              <dt>模型请求</dt><dd>{execution.modelSteps ?? "未记录"}</dd>
              <dt>工具调用</dt><dd>{missingLedger ? "记录不完整" : `${execution.counts.total} 项`}</dd>
              <dt>调用已返回</dt><dd>{missingLedger ? "未记录" : `${execution.counts.completed} 项`}</dd>
              <dt>失败 / 拒绝</dt><dd>{missingLedger ? "未记录" : `${execution.counts.failed} / ${execution.counts.rejected}`}</dd>
              <dt>等待批准 / 待核实</dt><dd>{missingLedger ? "未记录" : `${execution.counts.waiting} / ${execution.counts.unknown}`}</dd>
              <dt>最后请求提供的工具</dt><dd>{execution.offeredTools ?? "未记录"}</dd>
              <dt>请求协议</dt><dd>{execution.protocol ?? "未记录"}</dd>
            </dl>
          </PopoverContent>
        </Popover>
      </div>
      {activity.map((item) => item.kind === "text"
        ? <Markdown key={item.id} {...MARKDOWN_PROPS} className="agent-activity-narrative">{item.content}</Markdown>
        : item.kind === "reasoning"
          ? <ThinkingPanel key={item.id} reasoning={item.content} active={false} durationMs={item.durationMs} />
          : <ToolGroup key={item.id} calls={item.calls} run={run} busy={busy} readOnly={readOnly} unknown={unknown} executing={executing} onAction={onAction} />)}
      {currentReasoning && <ThinkingPanel reasoning={currentReasoning} active={reasoningActive} durationMs={message.reasoningDurationMs} />}
      {currentContent && <Markdown {...MARKDOWN_PROPS} className="agent-activity-narrative">{currentContent}</Markdown>}
      {run.status === "running" && <div className="agent-activity-working" role="status"><LoaderCircle size={12} className="animate-spin motion-reduce:animate-none" aria-hidden /><span>{executing ? "正在执行工具" : currentContent ? "正在撰写" : "正在思考"}</span></div>}
      {run.plan && run.plan.length > 0 && <details className="agent-activity-plan">
        <summary>执行计划 · {run.plan.filter((step) => step.status === "completed").length}/{run.plan.length}<ChevronDown size={12} aria-hidden /></summary>
        <ol className="agent-run-plan" aria-label="本次执行计划">{run.plan.map((step) => <li key={step.id}>
          <StepIcon status={step.status === "completed" ? "completed" : step.status === "in_progress" ? "running" : "pending"} />
          <span>{step.title}<small>{step.status === "completed" ? "已完成" : step.status === "in_progress" ? "进行中" : "待办"}</small></span>
        </li>)}</ol>
      </details>}
      </>}
      {/* Keep mounted: review dialogs own unsaved drafts and navigation guards. */}
      <AgentGenerationResults runId={run.id} />
      {unknown && <p role="status" className="text-xs text-amber-500">上次操作的结果尚未确认，为避免重复执行，已暂停自动接续。请先核实已有结果，再结束本次执行。</p>}
      {!readOnly && recoverable && <div className="agent-step-actions">
        {!unknown && !pendingApproval && <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction(run.id, "resume")}>{budgetPaused ? `继续执行 · 最多 ${MODEL_STEPS_PER_SEGMENT} 轮` : "从已保存的步骤继续"}</Button>}
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => onAction(run.id, "cancel")}>结束本次执行</Button>
      </div>}
    </div>
  </section>;
}
