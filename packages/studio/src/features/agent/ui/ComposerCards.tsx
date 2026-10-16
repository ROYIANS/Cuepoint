import {type ComponentPropsWithoutRef, type KeyboardEvent, type ReactNode, useState} from "react";
import {X} from "../../../ui/icons";
import {type ComposerDecision, useComposerAttention} from "./composerAttention";
import type {AgentTask} from "../models/agent";
import "./composerCards.css";
import "./composerAttention.css";

type CardKind = "decision" | "problem";

const ATTENTION_ERROR = "attention-error";
const ATTENTION_ERROR_TEXT = "待办读取失败，请刷新后检查执行记录。";

function noopOpen() {}

function onEscape(close: () => void) {
    return (event: KeyboardEvent<HTMLElement>) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        close();
    };
}

function CloseButton({onClose}: {onClose: () => void}) {
    return <button type="button" className="agent-composer-card-close" aria-label="关闭" onClick={onClose}><X size={14} aria-hidden/></button>;
}

function DecisionCard({item, onClose}: {item: ComposerDecision; onClose: () => void}) {
    return <section className="agent-composer-card" data-kind="decision" id="agent-composer-card-decision" aria-label={item.title}
                     onKeyDown={onEscape(onClose)}>
        <header className="agent-composer-card-head"><strong>{item.title}</strong><CloseButton onClose={onClose}/></header>
        <div className="agent-composer-card-line">
            <p className="agent-composer-card-detail" title={item.detail}>{item.detail}</p>
            <button type="button" className="agent-composer-card-action" aria-label={`${item.action}：${item.detail}`}
                    onClick={item.onAction}>{item.action}</button>
        </div>
    </section>;
}

function AttentionErrorCard({onClose}: {onClose: () => void}) {
    return <section className="agent-composer-card" data-kind="decision" id="agent-composer-card-decision" role="alert"
                     onKeyDown={onEscape(onClose)}>
        <div className="agent-composer-card-line">
            <p className="agent-attention-read-error" title={ATTENTION_ERROR_TEXT}>{ATTENTION_ERROR_TEXT}</p>
            <CloseButton onClose={onClose}/>
        </div>
    </section>;
}

function preferKind(kinds: readonly CardKind[]): CardKind | null {
    if (kinds.includes("problem")) return "problem";
    return kinds[0] ?? null;
}

function selectedKind(kinds: readonly CardKind[], picked: CardKind | null, collapsed: boolean): CardKind | null {
    if (collapsed && kinds.length > 1) return null;
    if (picked && kinds.includes(picked)) return picked;
    return preferKind(kinds);
}

function pillLabel(kind: CardKind, decision: ComposerDecision | undefined, problemLabel?: string): string {
    if (kind === "decision") return decision?.title ?? "待办读取失败";
    return problemLabel ?? "提示";
}

function KindPills({kinds, selected, decision, problemLabel, onChoose}: {
    kinds: readonly CardKind[];
    selected: CardKind | null;
    decision?: ComposerDecision;
    problemLabel?: string;
    onChoose: (kind: CardKind) => void;
}) {
    if (kinds.length < 2) return null;
    return <div className="agent-composer-card-pills" role="tablist" aria-label="对话卡片">
        {kinds.map(kind => <button key={kind} type="button" role="tab" aria-selected={selected === kind}
                                   aria-controls={`agent-composer-card-${kind}`} onClick={() => onChoose(kind)}>
            <span>{pillLabel(kind, decision, problemLabel)}</span>
        </button>)}
    </div>;
}

function ActiveCard({selected, decision, decisionError, problem, onCloseDecision}: {
    selected: CardKind | null;
    decision?: ComposerDecision;
    decisionError: boolean;
    problem?: ReactNode;
    onCloseDecision: () => void;
}) {
    if (selected === "decision" && decision) return <DecisionCard item={decision} onClose={onCloseDecision}/>;
    if (selected === "decision" && decisionError) return <AttentionErrorCard onClose={onCloseDecision}/>;
    if (selected === "problem") return problem;
    return null;
}

/**
 * At most one card above the composer. A result preview is omitted until an openable
 * artifact is already attached; nothing here invents one.
 */
export function ComposerCards({decisions, decisionError = false, problem, problemId, problemLabel}: {
    decisions: readonly ComposerDecision[];
    decisionError?: boolean;
    problem?: ReactNode;
    problemId?: string;
    problemLabel?: string;
}) {
    const [hiddenDecisions, setHiddenDecisions] = useState<ReadonlySet<string>>(() => new Set());
    const [choice, setChoice] = useState<{problemId?: string; kind: CardKind | null; collapsed: boolean}>({kind: null, collapsed: false});
    const freshProblem = Boolean(problemId) && choice.problemId !== problemId;
    const collapsed = freshProblem ? false : choice.collapsed;
    const picked = freshProblem ? "problem" : choice.kind;
    const decision = decisions.find(item => !hiddenDecisions.has(item.id));
    const showDecision = Boolean(decision) || (decisionError && !hiddenDecisions.has(ATTENTION_ERROR));
    const showProblem = problem !== undefined && problem !== null;
    const kinds: CardKind[] = [];
    if (showDecision) kinds.push("decision");
    if (showProblem) kinds.push("problem");
    const selected = selectedKind(kinds, picked, collapsed);
    const choose = (kind: CardKind) => setChoice({problemId, kind, collapsed: false});
    const closeDecision = () => {
        const id = decision?.id ?? ATTENTION_ERROR;
        setHiddenDecisions(previous => {
            const next = new Set(previous);
            next.add(id);
            return next;
        });
    };
    if (!kinds.length) return null;
    return <>
        <ActiveCard selected={selected} decision={decision} decisionError={decisionError} problem={problem}
                    onCloseDecision={closeDecision}/>
        <KindPills kinds={kinds} selected={selected} decision={decision} problemLabel={problemLabel} onChoose={choose}/>
    </>;
}

function noticeMeta(notice: ReactNode): {id?: string; label?: string} {
    if (!notice || typeof notice !== "object" || !("props" in notice)) return {};
    const problem = (notice.props as {problem?: {id?: string; reason?: string}}).problem;
    return {id: problem?.id, label: problem?.reason};
}

/** Reads the existing approval queue. Running work stays in the sidebar. */
export function ComposerCardHost({notice, attention}: {
    notice?: ReactNode;
    attention?: {threadId: string; task?: AgentTask; projectUnavailable: boolean; onOpenTask: () => void};
}) {
    const view = useComposerAttention({
        threadId: attention?.threadId,
        task: attention?.task,
        projectUnavailable: attention?.projectUnavailable ?? false,
        onOpenTask: attention?.onOpenTask ?? noopOpen,
    });
    const meta = noticeMeta(notice);
    return <div className="agent-composer-cards">
        <ComposerCards decisions={view.status === "ready" ? view.items : []}
                       decisionError={view.status === "error"} problem={notice} problemId={meta.id} problemLabel={meta.label}/>
    </div>;
}

/** The composer stack: cards first, then the draft frame. Cards are never inside the frame. */
export function ComposerSurface({stackClassName, above, frameClassName, frameProps, after, children}: {
    stackClassName?: string;
    above?: ReactNode;
    frameClassName: string;
    frameProps?: Omit<ComponentPropsWithoutRef<"div">, "className" | "children">;
    after?: ReactNode;
    children: ReactNode;
}) {
    return <div className={stackClassName ? `agent-composer-stack ${stackClassName}` : "agent-composer-stack"}>
        {above}
        <div className={frameClassName} {...frameProps}>{children}</div>
        {after}
    </div>;
}
