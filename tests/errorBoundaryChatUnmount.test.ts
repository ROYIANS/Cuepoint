// @vitest-environment jsdom
import {act, createElement as h} from "react";
import {createRoot, type Root} from "react-dom/client";
import {describe, expect, it, vi} from "vitest";
import {db} from "@/platform/product/store";
import {beginAgentRun} from "@/features/agent/commands/agentRuns";
import {createChatThread} from "@/features/agent/commands/chat";
import {recoverAbandonedRuns, type ThreadLockManager} from "@/features/agent/runtime/runOwnership";
import {useChatExecutionSession} from "@/features/agent/ui/useChatExecutionSession";
import {ErrorFallbackView} from "@/app/errors/ErrorFallback";
import type {ConnectorConfig} from "@/features/settings/models/connector";
import {createAgentExecutionService, type AgentExecutionService} from "@/features/agent/runtime/agentExecutionService";
import {createSubmissionAttempt} from "@/features/agent/models/chatSubmissionAttempt";

const runtime = vi.hoisted(() => ({execution: undefined as AgentExecutionService | undefined}));
vi.mock("@/features/agent/runtime/agentExecution", () => ({get agentExecution() {return runtime.execution!;}}));

(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

const connector: ConnectorConfig = {id: "boundary-cx", name: "t", definitionId: "openai-compatible", baseUrl: "https://example.test/v1", apiKey: "k", updatedAt: "2026-01-01"};
const freeLocks: ThreadLockManager = {request: (_name, _options, callback) => callback({})};
const heldLocks: ThreadLockManager = {request: (_name, _options, callback) => callback(null)};

describe("error boundary unmounting the chat page", () => {
    it("detaches the view while its original execution survives until explicit Stop and completion", async () => {
        const owner = createAgentExecutionService({store: new Proxy(db, {}), locks: freeLocks});
        runtime.execution = owner;
        await owner.initialize();
        let release!: () => void;
        const held = new Promise<void>(resolve => {release = resolve;});
        const attempt = createSubmissionAttempt({originThreadId: "thread-a", submitted: {scope: "boundary-view", text: "请继续", textRevision: 1, attachments: [], imports: []},
            recovery: {scope: "boundary-view", revision: 2}, connector, model: "m", taskMode: false, interactionMode: "conversation"});
        const original = owner.submit({attempt, afterOptimisticPaint: held});
        const originalWork = owner.snapshot("thread-a").work!;
        let observed: ReturnType<typeof useChatExecutionSession> | undefined;
        let completed = false;
        void original.done.then(() => {completed = true;});
        function Probe() {
            observed = useChatExecutionSession("thread-a", "boundary-view");
            return null;
        }
        const container = document.createElement("div");
        let root: Root | undefined = createRoot(container);
        try {
            await act(async () => { root!.render(h(Probe)); });
            expect(observed!.sending).toBe(true);
            expect(observed!.snapshot.token).toBe(original.token);
            await act(async () => { root!.unmount(); });
            root = undefined;
            expect(originalWork.controller.signal.aborted).toBe(false);
            expect(owner.snapshot("thread-a").work).toBe(originalWork);
            expect(owner.snapshot("thread-a").active).toBe(true);

            root = createRoot(container);
            await act(async () => { root!.render(h(Probe)); });
            expect(observed!.snapshot.token).toBe(original.token);
            expect(observed!.snapshot.work).toBe(originalWork);
            await act(async () => {
                expect(owner.requestStop(original)).toBe(true);
                expect(owner.requestStop(original)).toBe(false);
            });
            expect(originalWork.controller.signal.aborted).toBe(true);
            expect(observed!.sending).toBe(true);
            expect(observed!.stopping).toBe(true);
            expect(completed).toBe(false);
            await act(async () => {release(); await original.done;});
            expect(completed).toBe(true);
            expect(observed!.sending).toBe(false);
            expect(owner.snapshot("thread-a").work).toBeUndefined();
            expect(await db.agentRuns.count()).toBe(0);
        } finally {
            await act(async () => {
                owner.requestStop(original);
                release();
                await original.done.catch(() => undefined);
                root?.unmount();
            });
            await owner.shutdown();
        }
    });

    it("leaves a running run persisted and recovery marks it interrupted without losing messages", async () => {
        const thread = await createChatThread();
        const run = await beginAgentRun({threadId: thread.id, connector, model: "m", content: "请继续"});
        expect((await db.agentRuns.get(run.id))?.status).toBe("running");

        // Another page still owns the thread lock: recovery must not touch the run.
        await recoverAbandonedRuns(heldLocks);
        expect((await db.agentRuns.get(run.id))?.status).toBe("running");

        // Cold recovery after the original owner is gone marks abandoned work interrupted.
        await recoverAbandonedRuns(freeLocks);
        const recovered = await db.agentRuns.get(run.id);
        expect(recovered?.status).toBe("interrupted");
        const messages = await db.chatMessages.where("threadId").equals(thread.id).toArray();
        expect(messages.some(message => message.id === run.userMessageId && message.content === "请继续")).toBe(true);
        expect(messages.some(message => message.id === run.assistantMessageId)).toBe(true);
        expect(recovered?.error).toBeTruthy();
    });

    it("the agent-path fallback warns that unsent input may be lost", async () => {
        const container = document.createElement("div");
        const root = createRoot(container);
        await act(async () => {
            root.render(h(ErrorFallbackView, {error: new Error("x"), pathname: "/agent/thread-a", onRetry: () => undefined, onHome: () => undefined, onDetails: () => undefined}));
        });
        expect(container.textContent).toContain("输入框中未发送的内容可能丢失");
        expect(container.textContent).toContain("重试后可继续");
        await act(async () => { root.unmount(); });
    });
});
