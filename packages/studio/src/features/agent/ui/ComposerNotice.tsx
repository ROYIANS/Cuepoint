import type {KeyboardEvent} from "react";
import {CircleAlert, X} from "../../../ui/icons";
import type {TurnProblem, TurnProblemActionKind} from "../models/turnProblem";
import "./composerCards.css";
import "./composerNotice.css";

/**
 * The single problem card for an unsent / interrupted / failed / stopped turn.
 * It sits above the composer as its own surface: short reason, one primary action, close.
 * Approvals and confirmations stay on their own decision card.
 */
export function ComposerNotice({problem, busy, onAction, onDismiss}: {
    problem: TurnProblem;
    busy: boolean;
    onAction: (problem: TurnProblem, action: TurnProblemActionKind) => void;
    onDismiss: (problem: TurnProblem) => void;
}) {
    const urgent = problem.kind === "failed" || problem.kind === "unsent";
    const close = (event: KeyboardEvent<HTMLElement>) => {
        if (event.key !== "Escape" || !problem.dismissible) return;
        event.stopPropagation();
        onDismiss(problem);
    };
    return <div className="agent-composer-card agent-composer-notice" id="agent-composer-card-problem" data-kind={problem.kind}
                role={urgent && !problem.pending ? "alert" : "status"} onKeyDown={close}>
        <CircleAlert size={14} aria-hidden/>
        <span className="agent-composer-notice-reason" title={problem.detail}>{problem.reason}</span>
        {problem.secondary && <button type="button" className="agent-composer-notice-secondary" disabled={busy}
                                      onClick={() => onAction(problem, problem.secondary!.kind)}>{problem.secondary.label}</button>}
        {problem.action && <button type="button" className="agent-composer-notice-action" disabled={busy}
                                   onClick={() => onAction(problem, problem.action!.kind)}>{problem.action.label}</button>}
        {problem.dismissible && <button type="button" className="agent-composer-notice-close" aria-label="关闭提示"
                                        onClick={() => onDismiss(problem)}><X size={14} aria-hidden/></button>}
    </div>;
}
