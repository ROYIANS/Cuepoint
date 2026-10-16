import {ComposerCards} from "./ComposerCards";
import {useComposerAttention} from "./composerAttention";
import type {AgentTask} from "../models/agent";

/** One decision at a time from the existing approval/confirmation queue. */
export function AgentComposerAttention({threadId, task, projectUnavailable, onOpenTask}: {
    threadId: string;
    task?: AgentTask;
    projectUnavailable: boolean;
    onOpenTask: () => void;
}) {
    const view = useComposerAttention({threadId, task, projectUnavailable, onOpenTask});
    if (view.status === "loading") return null;
    return <ComposerCards decisions={view.items} decisionError={view.status === "error"}/>;
}
