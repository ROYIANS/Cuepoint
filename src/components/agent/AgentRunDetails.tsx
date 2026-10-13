import {CreatedEntityLinks} from "./CreatedEntityLinks";
import {AgentWriteOutcomes} from "./AgentWriteOutcomes";
import {WebResearchSources} from "./WebResearchSources";
import {ProjectImageSources} from "./ProjectImageSources";
import {GenerationReview} from "./GenerationReview";
import {MusicGenerationReview} from "./MusicGenerationReview";
import {AgentGenerationResults} from "./AgentGenerationResults";
import {Link} from "@tanstack/react-router";
import {useEffect, useId, useMemo, useRef, useState} from "react";
import {Markdown} from "@lobehub/ui";
import {Check, ChevronDown, Circle, CircleAlert, LoaderCircle, ShieldQuestion, Wrench} from "@/components/ui/icons";
import {canResumeAgentRun} from "@/db/agentTools";
import type {AgentRun, AgentToolCall} from "@/domain/agent";
import {MODEL_STEPS_PER_SEGMENT} from "@/domain/agent";
import {Button} from "@/components/ui/button";
import type {ChatMessage} from "@/domain/types";
import {buildRunActivity, isPersistedToolRound} from "@/lib/agent/runPresentation";
import {readToolRecoveryFailure, readToolValidationFailure, type ToolRecoveryFailure} from "@/lib/agent/toolErrors";
import {ThinkingPanel} from "./ThinkingPanel";
import {useAgentActivityNavigation} from "./AgentActivityNavigation";
import "./executionActivity.css";

const MARKDOWN_PROPS = {variant: "chat"} as const;

export type RunAction = "resume" | "cancel" | "approve" | "reject";
const STATUS: Record<AgentToolCall["status"], string> = {
    pending: "准备执行", awaiting_approval: "等待批准", approved: "已批准，等待执行",
    running: "执行中", completed: "已完成", failed: "失败", rejected: "已拒绝", unknown: "结果待核实",
};
const EFFECT: Record<AgentToolCall["effect"], string> = {
    read: "读取本地数据", write: "编辑数据", network: "使用互联网", bookkeeping: "维护任务与计划",
};

function StepIcon({status}: { status: AgentToolCall["status"] }) {
    if (status === "completed") return <Check size={15} className="text-green-500"/>;
    if (status === "running") return <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none"/>;
    if (status === "awaiting_approval") return <ShieldQuestion size={15} className="text-amber-500"/>;
    if (status === "failed" || status === "unknown") return <CircleAlert size={15} className="text-amber-500"/>;
    return <Circle size={15}/>;
}

function RecoveryFailureNotice({failure}: {failure: ToolRecoveryFailure}) {
    return <div className="agent-tool-failure" role="alert">
        <strong>{failure.effectCertainty === "rolled_back" ? "操作已回滚" : failure.effectCertainty === "not_started" ? "操作未开始" : "操作结果待核实"}</strong>
        <p>{failure.error}</p>
        <p className="agent-tool-failure-recovery">{failure.recovery}</p>
    </div>;
}

function ToolCallRow({run, call, busy, readOnly, unknown, executing, onAction}: {
    run: AgentRun; call: AgentToolCall; busy: boolean; readOnly?: boolean;
    unknown: boolean; executing: boolean;
    onAction: (runId: string, action: RunAction, callId?: string) => void;
}) {
    const {request} = useAgentActivityNavigation();
    const [open, setOpen] = useState(call.status === "awaiting_approval" || call.status === "unknown");
    const panelId = useId();
    useEffect(() => {
        if (request?.runId === run.id && request.callId === call.id) setOpen(true);
    }, [request, run.id, call.id]);
    const recoverable = canResumeAgentRun(run);
    const reviewGeneration = !readOnly && call.name === "submit_generation" && call.status === "awaiting_approval" && recoverable && !unknown && !executing;
    const musicReview = call.name === "music_generate";
    const activeMusicReview = musicReview && !readOnly && call.status === "awaiting_approval" && recoverable && !unknown && !executing;
    const preview = call.generationOverride?.preview ?? call.preview;
    const structuredValidation = useMemo(() => call.status === "failed" ? readToolValidationFailure(call.result) : undefined, [call.status, call.result]);
    const recovery = useMemo(() => call.status === "failed" ? readToolRecoveryFailure(call.result) : undefined, [call.status, call.result]);
    return <div className="agent-run-step" data-activity-call={call.id}>
        <button type="button" className="agent-tool-call-toggle" aria-expanded={open} aria-controls={panelId}
                onClick={() => setOpen((value) => !value)}>
            <StepIcon status={call.status}/><span>{call.title}</span><small>{STATUS[call.status]}</small><ChevronDown
            size={12} className={open ? "rotate-180" : ""} aria-hidden/>
        </button>
        <div id={panelId} hidden={!open}>
            <div className="agent-step-payload">
                <p>{EFFECT[call.effect]}{recovery?.effectCertainty === "rolled_back" ? " · 已回滚" : structuredValidation || recovery?.effectCertainty === "not_started" ? " · 未执行" : call.highRisk ? " · 高风险操作" : ""}</p>
                {recovery && <RecoveryFailureNotice failure={recovery}/>}
                {musicReview ? <MusicGenerationReview key={call.id} call={call} busy={busy} active={activeMusicReview}
                                                      onAction={onAction}/> : reviewGeneration ?
                    <GenerationReview call={call} busy={busy} onAction={onAction}/> : preview &&
                    <div className="agent-change-preview">
                        <strong>{preview.summary}</strong>
                        {preview.changes.length > 0 &&
                            <ul>{preview.changes.map((change, index) => <li key={index}>{change}</li>)}</ul>}
                        {preview.target && /^\/(?!\/)/.test(preview.target.href) && <Link to={preview.target.href}
                                                                                          className="agent-change-link">查看{preview.target.label} ↗</Link>}
                    </div>}
                <WebResearchSources call={call}/>
                <ProjectImageSources call={call}/>
                <details className="agent-step-technical">
                    <summary>参数与返回结果</summary>
                    <div className="agent-step-payload-label">AI 原始参数</div>
                    <pre>{call.arguments}</pre>
                    {call.generationOverride && <>
                        <div className="agent-step-payload-label">用户确认的参数</div>
                        <pre>{call.generationOverride.arguments}</pre>
                    </>}
                    {call.result && <>
                        <div className="agent-step-payload-label">返回结果</div>
                        <pre>{call.result}</pre>
                    </>}
                </details>
                {call.error && !recovery && <p className="text-destructive">{call.error}</p>}
            </div>
            {call.name !== "project_create" && <CreatedEntityLinks call={call}/>}
            {!readOnly && !reviewGeneration && !musicReview && call.status === "awaiting_approval" && recoverable && !unknown && !executing &&
                <div className="agent-step-actions">
                    <Button size="sm" disabled={busy}
                            onClick={() => onAction(run.id, "approve", call.id)}>批准此次操作</Button>
                    <Button size="sm" variant="outline" disabled={busy}
                            onClick={() => onAction(run.id, "reject", call.id)}>拒绝</Button>
                </div>}
        </div>
        {call.name === "project_create" && <CreatedEntityLinks call={call} allowProjectConversation={!readOnly}/>}
    </div>;
}

function ToolGroup({calls, ...props}: Omit<Parameters<typeof ToolCallRow>[0], "call"> & { calls: AgentToolCall[] }) {
    const {request} = useAgentActivityNavigation();
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
        <button type="button" className="agent-tool-group-toggle" aria-expanded={open} aria-controls={panelId}
                onClick={() => setOpen((value) => !value)}>
            {running ? <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden/> :
                <Wrench size={14} aria-hidden/>}
            <span>{label}</span><small>{calls.length} 项{attention ? " · 待处理" : failed ? ` · 含 ${failed} 项失败` : running ? " · 执行中" : ""}</small><ChevronDown
            size={12} className={open ? "rotate-180" : ""} aria-hidden/>
        </button>
        <div id={panelId} className="agent-tool-group-calls" hidden={!open}>
            {calls.map((call) => <ToolCallRow key={call.id} {...props} call={call}/>)}
        </div>
    </div>;
}

export function AgentRunDetails({run, message, calls, busy, readOnly, onAction}: {
    run: AgentRun; message: ChatMessage; calls: AgentToolCall[];
    busy: boolean; readOnly?: boolean;
    onAction: (runId: string, action: RunAction, callId?: string) => void;
}) {
    const {request} = useAgentActivityNavigation();
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
    const toolCount = ownedCalls.filter((call) => call.effect !== "bookkeeping").length;
    const running = run.status === "running";
    // Plain replies without tools, reasoning or plan have no process to disclose.
    const hasProcess = running || ownedCalls.length > 0 || activity.length > 0 || Boolean(currentReasoning) || Boolean(run.plan?.length);

    useEffect(() => {
        if (expanded) setHasExpanded(true);
    }, [expanded]);

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
            if (!request.batchId) target.querySelector<HTMLElement>("button:not([disabled])")?.focus({preventScroll: true});
        });
        return () => cancelAnimationFrame(frame);
    }, [request, run.id, calls]);

    return <section ref={sectionRef} className="agent-run-activity agent-execution-activity" aria-label="执行过程"
                    data-activity-run={run.id}>
        {hasProcess && <Button variant="ghost" className="agent-run-summary agent-execution-summary h-auto justify-start rounded-none"
                aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpanded((value) => !value)}>
            {running && <LoaderCircle size={12} className="animate-spin motion-reduce:animate-none" aria-hidden/>}
            <span>{running ? (toolCount > 0 ? `进行中 · 已用 ${toolCount} 个工具` : "进行中") : toolCount > 0 ? `用了 ${toolCount} 个工具` : "过程记录"}</span>
            <ChevronDown size={14} className={expanded ? "rotate-180" : ""} aria-hidden/>
        </Button>}
        <AgentWriteOutcomes run={run} calls={ownedCalls}/>
        <div id={panelId} className="agent-execution-timeline" hidden={hasProcess && !expanded}>
            {(expanded || hasExpanded) && <>
                {activity.map((item) => item.kind === "text"
                    ? <Markdown key={item.id} {...MARKDOWN_PROPS}
                                className="agent-activity-narrative">{item.content}</Markdown>
                    : item.kind === "reasoning"
                        ? <ThinkingPanel key={item.id} reasoning={item.content} active={false}
                                         durationMs={item.durationMs}/>
                        : <ToolGroup key={item.id} calls={item.calls} run={run} busy={busy} readOnly={readOnly}
                                     unknown={unknown} executing={executing} onAction={onAction}/>)}
                {currentReasoning && <ThinkingPanel reasoning={currentReasoning} active={reasoningActive}
                                                    durationMs={message.reasoningDurationMs}/>}
                {currentContent &&
                    <Markdown {...MARKDOWN_PROPS} className="agent-activity-narrative">{currentContent}</Markdown>}
                {run.plan && run.plan.length > 0 && <details className="agent-activity-plan">
                    <summary>执行计划
                        · {run.plan.filter((step) => step.status === "completed").length}/{run.plan.length}<ChevronDown
                            size={12} aria-hidden/></summary>
                    <ol className="agent-run-plan" aria-label="本次执行计划">{run.plan.map((step) => <li key={step.id}>
                        <StepIcon
                            status={step.status === "completed" ? "completed" : step.status === "in_progress" ? "running" : "pending"}/>
                        <span>{step.title}<small>{step.status === "completed" ? "已完成" : step.status === "in_progress" ? "进行中" : "待办"}</small></span>
                    </li>)}</ol>
                </details>}
            </>}
            {/* Keep mounted: review dialogs own unsaved drafts and navigation guards. */}
            <AgentGenerationResults runId={run.id}/>
            {unknown && <p role="status"
                           className="text-xs text-amber-500">上次操作的结果尚未确认，为避免重复执行，已暂停自动接续。请先核实已有结果，再结束本次执行。</p>}
            {!readOnly && recoverable && <div className="agent-step-actions">
                {!unknown && !pendingApproval && <Button size="sm" variant="outline" disabled={busy}
                                                         onClick={() => onAction(run.id, "resume")}>{budgetPaused ? `继续执行 · 最多 ${MODEL_STEPS_PER_SEGMENT} 轮` : "从已保存的步骤继续"}</Button>}
                <Button size="sm" variant="ghost" disabled={busy}
                        onClick={() => onAction(run.id, "cancel")}>结束本次执行</Button>
            </div>}
        </div>
    </section>;
}
