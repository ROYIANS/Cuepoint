import {currentAgentThreadWork, reserveAgentThreadWork, subscribeAgentThreadWork, shutdownAgentThreadWork} from "./threadWork";
import {recoverTaskWrapups, prepareTaskWrapup} from "./taskWrapup";
import type {AgentReasoningEffort} from "../models/agent";
import {createId} from "../../../platform/identity";
import {StorageError} from "../../../platform/storage/errors";
import {resolveConnector} from "../../settings/commands/connectors";
import type {ChatModelMetadata} from "../../settings/models/modelMetadata";
import {connectorRunIdentity} from "../commands/agentRuns";
import type {ChatSubmissionAttempt} from "../models/chatSubmissionAttempt";
import type {RunAction} from "../models/chatRunAction";
import {readAgentAdmission} from "../queries/agentAdmission";
import {createExecutionFeedbackController, type ExecutionFeedbackInvocation, type ExecutionFeedbackSnapshot} from "./executionFeedback";
import {executeNewChatMessage, resolveChatRunAction, retryFrozenChatRun, type ChatExecutionBinding} from "./chatExecutionFlows";
import {recoverAbandonedRuns, withThreadRunLock} from "./runOwnership";

const invocationBrand: unique symbol = Symbol("AgentInvocation");
/** Opaque local identity; persisted IDs never reconstruct an invocation owner. */
export interface AgentExecutionToken {readonly [invocationBrand]: true; readonly id: string}
export interface AgentExecutionHandle {
    readonly threadId: string;
    readonly token: AgentExecutionToken;
    readonly done: Promise<void>;
}
export interface AgentExecutionSnapshot {
    readonly threadId: string;
    readonly active: boolean;
    readonly stopping: boolean;
    readonly token?: AgentExecutionToken;
    readonly kind?: "submit" | "retry" | "decision" | "check" | "recovery" | "taskWrapup" | "videoBatch" | "audioBatch";
    readonly feedback?: Readonly<ExecutionFeedbackSnapshot>;
    readonly attempts: readonly ChatSubmissionAttempt[];
    readonly error?: string;
    readonly wrapupId?: string;
    readonly work?: import("./threadWork").AgentThreadWork;
}
interface Invocation {
    token: AgentExecutionToken;
    controller: AbortController;
    feedback: ExecutionFeedbackInvocation;
    done: Promise<void>;
    stopping: boolean;
    wrapupId?: string;
    kind: NonNullable<AgentExecutionSnapshot["kind"]>;
}
interface ThreadState {
    invocation?: Invocation;
    feedback?: Readonly<ExecutionFeedbackSnapshot>;
    feedbackOwner: ReturnType<typeof createExecutionFeedbackController>;
    lastFeedback?: {token: AgentExecutionToken; invocation: ExecutionFeedbackInvocation};
    attempts: ChatSubmissionAttempt[];
    snapshot: AgentExecutionSnapshot;
    listeners: Set<() => void>;
    error?: string;
}

/** Copy only local submitted data; never store a ConnectorConfig/API key in snapshots. */
function freezeAttempt(attempt: ChatSubmissionAttempt): ChatSubmissionAttempt {
    const attachments = attempt.submitted.attachments.map(item => Object.freeze({...item}));
    const imports = attempt.submitted.imports.map(item => Object.freeze({...item}));
    Object.freeze(attachments);
    Object.freeze(imports);
    const createdThread = attempt.createdThread ? structuredClone(attempt.createdThread) : undefined;
    if (createdThread) {
        if (createdThread.excludedMemoryIds) Object.freeze(createdThread.excludedMemoryIds);
        if (createdThread.contextPolicy) Object.freeze(createdThread.contextPolicy);
        if (createdThread.reasoningSelection) Object.freeze(createdThread.reasoningSelection);
        Object.freeze(createdThread);
    }
    return Object.freeze({...attempt,
        admission: Object.freeze({...attempt.admission}), connector: Object.freeze({id: attempt.connector.id,
            definitionId: attempt.connector.definitionId, baseUrl: attempt.connector.baseUrl}),
        recovery: Object.freeze({...attempt.recovery}),
        submitted: Object.freeze({...attempt.submitted, attachments, imports}), createdThread});
}

/** One application/document owner; views can detach without disposing its executions. */
export function createAgentExecutionService(options: ChatExecutionBinding) {
    const binding = Object.freeze({...options, registry: options.registry ? Object.freeze([...options.registry]) : undefined});
    const threads = new Map<string, ThreadState>();
    let admissionOpen = true;
    let initialized: Promise<void> | undefined;
    let shutdownPromise: Promise<void> | undefined;
    const scopeListeners = new Map<string, Set<() => void>>();
    const scopeSnapshots = new Map<string, readonly ChatSubmissionAttempt[]>();

    function state(threadId: string): ThreadState {
        let current = threads.get(threadId);
        if (current) return current;
        const feedbackOwner = createExecutionFeedbackController({onChange: feedback => {
            const owner = threads.get(threadId);
            if (!owner) return;
            owner.feedback = feedback ? Object.freeze({...feedback}) : undefined;
            if (owner.invocation) publish(threadId, owner);
        }});
        const work = currentAgentThreadWork(binding.store, threadId);
        current = {feedbackOwner, attempts: [], listeners: new Set(),
            snapshot: Object.freeze({threadId, active: !!work, stopping: work?.controller.signal.aborted ?? false, work,
                kind: work?.identity.kind === "model" ? undefined : work?.identity.kind, attempts: Object.freeze([])})};
        threads.set(threadId, current);
        return current;
    }
    function publish(threadId: string, owner: ThreadState) {
        const invocation = owner.invocation;
        const work = currentAgentThreadWork(binding.store, threadId);
        owner.snapshot = Object.freeze({threadId, active: !!invocation || !!work, stopping: invocation?.stopping ?? work?.controller.signal.aborted ?? false,
            wrapupId: invocation?.wrapupId, token: invocation?.token ?? owner.lastFeedback?.token, kind: invocation?.kind ?? (work?.identity.kind === "model" ? undefined : work?.identity.kind), work, feedback: owner.feedback,
            attempts: Object.freeze([...owner.attempts]), error: owner.error});
        for (const scope of new Set([...scopeSnapshots.keys(), ...scopeListeners.keys()])) {
            const listeners = scopeListeners.get(scope) ?? [];
            const previous = scopeSnapshots.get(scope);
            const next = [...threads.values()].flatMap(entry => entry.attempts).filter(attempt => attempt.submitted.scope === scope);
            if (!previous || previous.length !== next.length || next.some((item, index) => item !== previous[index])) {
                scopeSnapshots.set(scope, Object.freeze(next));
                for (const listener of [...listeners]) {try {listener();} catch { /* Detached view. */ }}
            }
        }
        for (const listener of [...owner.listeners]) {
            try {listener();} catch { /* A detached/broken view cannot own execution. */ }
        }
    }
    function patchAttempt(threadId: string, id: string, patch: Partial<ChatSubmissionAttempt>) {
        const owner = state(threadId);
        owner.attempts = owner.attempts.map(attempt => attempt.admission.userMessageId === id ? freezeAttempt({...attempt, ...patch}) : attempt);
        publish(threadId, owner);
    }
    function attemptFor(threadId: string, userMessageId: string) {
        const attempt = state(threadId).attempts.find(item => item.admission.userMessageId === userMessageId);
        if (!attempt) throw new Error("发送记录不存在");
        return attempt;
    }
    function admissionInput(attempt: ChatSubmissionAttempt) {
        return {threadId: attempt.threadId, admission: attempt.admission, connector: attempt.connector,
            model: attempt.model, projectId: attempt.projectId, content: attempt.submitted.text.trim(), attachments: attempt.submitted.attachments};
    }
    function initialize(): Promise<void> {
        initialized ??= (async () => {
            await recoverAbandonedRuns(binding.locks, binding.store);
            const rows = await binding.store.agentTaskWrapups.filter(row => row.status === "preparing").toArray();
            for (const threadId of new Set(rows.map(row => row.threadId))) await recoverTaskWrapups(threadId, binding.locks, binding.store);
        })();
        return initialized;
    }
    function claim(threadId: string, kind: Invocation["kind"], operation: (entry: Invocation) => Promise<void>,
                   submitted?: ChatSubmissionAttempt, taskId?: string): AgentExecutionHandle {
        if (!admissionOpen) throw new Error("应用正在退出，暂时无法开始执行");
        const owner = state(threadId);
        if (owner.invocation) throw new Error("当前对话尚有执行未结束，请等待完成或先停止");
        const token: AgentExecutionToken = Object.freeze({[invocationBrand]: true as const, id: createId("invocation")});
        const controller = new AbortController();
        const reservation = reserveAgentThreadWork(binding.store, kind === "taskWrapup" ? {kind, threadId, taskId: taskId!} :
            {kind: "model", threadId, invocationId: token.id}, controller);
        // Feedback initialization is private until the complete reservation is published.
        let resolveDone!: () => void;
        let rejectDone!: (cause: unknown) => void;
        const done = new Promise<void>((resolve, reject) => {resolveDone = resolve; rejectDone = reject;});
        const entry: Invocation = {token, controller, done, stopping: false, kind,
            feedback: owner.feedbackOwner.begin(token.id, threadId)};
        owner.invocation = entry;
        owner.error = undefined;
        if (submitted) owner.attempts = [...owner.attempts, submitted];
        owner.lastFeedback = {token, invocation: entry.feedback};
        publish(threadId, owner);
        void (async () => {
            try {
                await initialize();
                // Closing admission or stopping a reserved preparation never dispatches later.
                if (!controller.signal.aborted) await operation(entry);
                else if (submitted) patchAttempt(threadId, submitted.admission.userMessageId,
                    {phase: "failed", error: "发送已停止，可重试或恢复草稿"});
                resolveDone();
            } catch (cause) {
                // Error content is retained by the concrete operation/durable run, never by a toast callback.
                owner.error ??= "执行未完成，请查看对话记录后处理";
                if (submitted && attemptFor(threadId, submitted.admission.userMessageId).phase === "preparing") {
                    patchAttempt(threadId, submitted.admission.userMessageId, {phase: "failed", error: "发送未完成，可重试或恢复草稿"});
                }
                rejectDone(cause);
            } finally {
                // Original operation includes the actual writer flush/settlement, not an abort acknowledgement.
                if (owner.invocation === entry) {
                    entry.feedback.release();
                    owner.invocation = undefined;
                    publish(threadId, owner);
                }
            }
        })();
        reservation.follow(done);
        void done.catch(() => undefined);
        return Object.freeze({threadId, token, done: reservation.work.done});
    }
    async function checkAttempt(attempt: ChatSubmissionAttempt, feedback?: ExecutionFeedbackInvocation) {
        const status = await readAgentAdmission(admissionInput(attempt), binding.store);
        if (status.status === "accepted") {
            feedback?.admitted(status.run);
            patchAttempt(attempt.threadId, attempt.admission.userMessageId, {phase: "accepted",
                recoveryRequired: status.run.status === "running", error: undefined});
        }
        return status;
    }
    async function recordSubmissionFailure(attempt: ChatSubmissionAttempt, entry: Invocation, cause: unknown) {
        const uncertain = cause instanceof StorageError && cause.certainty === "unknown";
        patchAttempt(attempt.threadId, attempt.admission.userMessageId, {phase: uncertain ? "uncertain" : "failed",
            error: uncertain ? "尚无法确认发送结果，请核对状态" : "发送未完成，可重试或恢复草稿"});
        if (uncertain) {
            try {await checkAttempt(attempt, entry.feedback);} catch { /* Failed/absent reads never prove rollback. */ }
        }
    }
    async function send(attempt: ChatSubmissionAttempt, entry: Invocation, modelMetadata?: ChatModelMetadata, retry = false) {
        const id = attempt.admission.userMessageId;
        let admitted = false;
        try {
            if (retry) {
                const receipt = await checkAttempt(attempt, entry.feedback);
                if (receipt.status === "accepted") return; // Positive receipt is not dispatch permission.
                if (receipt.status !== "absent") {
                    patchAttempt(attempt.threadId, id, {phase: "uncertain", error: "发送记录不一致，请核对话题记录"});
                    return;
                }
            }
            entry.controller.signal.throwIfAborted();
            const connector = await resolveConnector(attempt.connector.id, binding.store);
            if (!connector) throw new Error("原连接已删除，请恢复连接后处理发送内容");
            const identity = connectorRunIdentity(connector);
            if (identity.id !== attempt.connector.id || identity.definitionId !== attempt.connector.definitionId ||
                identity.baseUrl !== new URL(attempt.connector.baseUrl).toString().replace(/\/+$/, "")) throw new Error("原连接已更改，请恢复草稿后重新发送");
            entry.controller.signal.throwIfAborted();
            const checked = await executeNewChatMessage({threadId: attempt.threadId, admission: attempt.admission,
                content: attempt.submitted.text.trim(), attachments: attempt.submitted.attachments,
                activeThread: attempt.createdThread, originThreadId: attempt.originThreadId, connector,
                model: attempt.model, taskMode: attempt.taskMode, projectId: attempt.projectId,
                interactionMode: attempt.interactionMode, reasoningEffort: attempt.reasoningEffort, modelMetadata,
                controller: entry.controller, feedback: entry.feedback,
                isCurrent: () => state(attempt.threadId).invocation === entry && !entry.controller.signal.aborted,
                onThreadReady: thread => patchAttempt(attempt.threadId, id, {createdThread: thread}),
                onAdmitted: () => {admitted = true; patchAttempt(attempt.threadId, id, {phase: "accepted", error: undefined});}
            }, binding);
            if (!admitted) patchAttempt(attempt.threadId, id, {phase: "failed",
                error: !checked.ok && !checked.aborted ? checked.message : "发送已停止，可重试或恢复草稿"});
        } catch (cause) {
            if (!admitted) await recordSubmissionFailure(attempt, entry, cause);
            // Do not expose a raw connector/provider/storage exception through the service snapshot.
            throw cause;
        }
    }
    function submit(input: {attempt: ChatSubmissionAttempt; modelMetadata?: ChatModelMetadata; afterOptimisticPaint?: Promise<void>}) {
        const attempt = freezeAttempt({...input.attempt, phase: "preparing", error: undefined});
        if (state(attempt.threadId).attempts.some(item => item.admission.userMessageId === attempt.admission.userMessageId)) throw new Error("发送内容已提交，请使用原发送记录");
        const modelMetadata = input.modelMetadata ? structuredClone(input.modelMetadata) : undefined;
        return claim(attempt.threadId, "submit", async entry => {
            await input.afterOptimisticPaint;
            if (entry.controller.signal.aborted) {patchAttempt(attempt.threadId, attempt.admission.userMessageId, {phase: "failed", error: "发送已停止，可重试或恢复草稿"}); return;}
            await send(attempt, entry, modelMetadata);
        }, attempt);
    }
    function retrySubmission(input: {threadId: string; userMessageId: string; modelMetadata?: ChatModelMetadata}) {
        const attempt = attemptFor(input.threadId, input.userMessageId);
        if (attempt.phase !== "failed") throw new Error("只有确认未发送的内容可以重试，请先核对发送状态");
        const modelMetadata = input.modelMetadata ? structuredClone(input.modelMetadata) : undefined;
        return claim(input.threadId, "submit", async entry => {
            patchAttempt(input.threadId, input.userMessageId, {phase: "preparing", error: undefined});
            await send(attempt, entry, modelMetadata, true);
        });
    }
    function runAction(input: {threadId: string; runId: string; action: RunAction; callId?: string}) {
        return claim(input.threadId, "decision", async entry => {
            const checked = await resolveChatRunAction({...input, controller: entry.controller, feedback: entry.feedback,
                isCurrent: () => state(input.threadId).invocation === entry && !entry.controller.signal.aborted}, binding);
            if (checked && !checked.ok && !checked.aborted) state(input.threadId).error = checked.message;
        });
    }
    subscribeAgentThreadWork(binding.store, () => {
        for (const [threadId, owner] of threads) publish(threadId, owner);
    });
    return {
        initialize,
        prepareTaskWrapup(input: {threadId: string; taskId: string; connectorId: string; model: string;
            reasoningEffort?: AgentReasoningEffort; modelMetadata?: ChatModelMetadata}) {
            const captured = {...input, modelMetadata: input.modelMetadata ? structuredClone(input.modelMetadata) : undefined};
            return claim(input.threadId, "taskWrapup", async entry => {
                const task = await binding.store.agentTasks.get(captured.taskId);
                if (!task || task.threadId !== captured.threadId) throw new Error("任务归属已变化");
                const connector = await resolveConnector(captured.connectorId, binding.store);
                if (!connector) throw new Error("连接不存在，请重新配置");
                if (entry.controller.signal.aborted) return;
                await prepareTaskWrapup(captured.taskId, connector, captured.model, entry.controller, binding.fetchImpl,
                    captured.reasoningEffort, captured.modelMetadata, binding.locks, binding.store, id => {
                        entry.wrapupId = id; publish(input.threadId, state(input.threadId));
                    });
            }, undefined, input.taskId);
        },
        snapshot: (threadId: string): AgentExecutionSnapshot => state(threadId).snapshot,
        subscribe(threadId: string, listener: () => void) {
            const owner = state(threadId);
            owner.listeners.add(listener);
            return () => {owner.listeners.delete(listener);};
        },
        attemptsForScope(scope: string) {
            let snapshot = scopeSnapshots.get(scope);
            if (!snapshot) {
                snapshot = Object.freeze([...threads.values()].flatMap(entry => entry.attempts).filter(attempt => attempt.submitted.scope === scope));
                scopeSnapshots.set(scope, snapshot);
            }
            return snapshot;
        },
        subscribeScope(scope: string, listener: () => void) {
            let listeners = scopeListeners.get(scope);
            if (!listeners) {listeners = new Set(); scopeListeners.set(scope, listeners);}
            listeners.add(listener); return () => {listeners.delete(listener);};
        },
        submit, retrySubmission,
        retry(input: {threadId: string; runId: string}) {
            return claim(input.threadId, "retry", async entry => {
                const checked = await retryFrozenChatRun({...input, controller: entry.controller, feedback: entry.feedback,
                    isCurrent: () => state(input.threadId).invocation === entry && !entry.controller.signal.aborted}, binding);
                if (!checked.ok && !checked.aborted) state(input.threadId).error = checked.message;
            });
        },
        resolveApproval: (input: {threadId: string; runId: string; callId: string; decision: "approve" | "reject"}) =>
            runAction({...input, action: input.decision}),
        resume: (input: {threadId: string; runId: string}) => runAction({...input, action: "resume"}),
        cancelSavedRun: (input: {threadId: string; runId: string}) => runAction({...input, action: "cancel"}),
        checkAdmission(input: {threadId: string; userMessageId: string}) {
            const attempt = attemptFor(input.threadId, input.userMessageId);
            if (attempt.phase !== "uncertain") throw new Error("此发送记录不需要核对状态");
            return claim(input.threadId, "check", async () => {
                patchAttempt(input.threadId, input.userMessageId, {phase: "checking"});
                try {
                    const status = await checkAttempt(attempt);
                    if (status.status !== "accepted") patchAttempt(input.threadId, input.userMessageId,
                        {phase: "uncertain", error: "仍无法确认发送结果，请稍后核对状态"});
                } catch {
                    patchAttempt(input.threadId, input.userMessageId, {phase: "uncertain", error: "读取发送状态失败，请稍后重试核对"});
                }
            });
        },
        recoverAdmissionState(input: {threadId: string; userMessageId: string}) {
            const attempt = attemptFor(input.threadId, input.userMessageId);
            if (attempt.phase !== "accepted" || !attempt.recoveryRequired) throw new Error("此发送记录不需要恢复状态");
            return claim(input.threadId, "recovery", async entry => {
                // Real lock-aware local recovery only. Never model/tool dispatch.
                try {await withThreadRunLock(input.threadId, () => {
                    if (!entry.controller.signal.aborted) patchAttempt(input.threadId, input.userMessageId, {recoveryRequired: false, error: undefined});
                    return Promise.resolve();
                }, binding.locks, binding.store);
                } catch (cause) {patchAttempt(input.threadId, input.userMessageId, {error: "暂时无法恢复对话，请稍后重试"}); throw cause;}
            });
        },
        requestStop(input: {threadId: string; token: AgentExecutionToken}): boolean {
            const owner = threads.get(input.threadId), entry = owner?.invocation;
            if (!owner || !entry || entry.token !== input.token || entry.stopping) return false;
            entry.stopping = true;
            entry.feedback.requestStop();
            publish(input.threadId, owner);
            entry.controller.abort();
            return true;
        },
        requestWorkStop(input: {threadId: string; work: import("./threadWork").AgentThreadWork}): boolean {
            if (currentAgentThreadWork(binding.store, input.threadId) !== input.work || input.work.controller.signal.aborted) return false;
            input.work.controller.abort();
            publish(input.threadId, state(input.threadId));
            return true;
        },
        feedback(threadId: string, token: AgentExecutionToken): ExecutionFeedbackInvocation | undefined {
            const feedback = threads.get(threadId)?.lastFeedback;
            return feedback?.token === token ? feedback.invocation : undefined;
        },
        /** Remove only a view-observed settled attempt; uncertainty/recovery must remain actionable. */
        dismissAttempt(input: {threadId: string; userMessageId: string}) {
            const owner = state(input.threadId);
            const attempt = attemptFor(input.threadId, input.userMessageId);
            if (owner.invocation || attempt.phase === "uncertain" || attempt.phase === "checking" || attempt.recoveryRequired) return false;
            owner.attempts = owner.attempts.filter(item => item !== attempt);
            publish(input.threadId, owner);
            return true;
        },
        shutdown(): Promise<void> {
            if (shutdownPromise) return shutdownPromise;
            admissionOpen = false;
            let resolveShutdown!: () => void;
            shutdownPromise = new Promise<void>(resolve => {resolveShutdown = resolve;});
            const current = [...threads.entries()].flatMap(([threadId, owner]) => owner.invocation ? [{threadId, owner, entry: owner.invocation}] : []);
            for (const {threadId, owner, entry} of current) {
                if (!entry.stopping) {
                    entry.stopping = true;
                    entry.feedback.requestStop();
                    publish(threadId, owner);
                    entry.controller.abort();
                }
            }
            void Promise.allSettled([...current.map(({entry}) => entry.done), shutdownAgentThreadWork(binding.store)]).then(resolveShutdown);
            return shutdownPromise;
        }
    };
}
export type AgentExecutionService = ReturnType<typeof createAgentExecutionService>;
