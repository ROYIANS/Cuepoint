// @vitest-environment jsdom
import {act, createElement as h, useEffect, useRef} from "react";
import {createRoot} from "react-dom/client";
import {describe, expect, it} from "vitest";
import {db} from "@/platform/product/store";
import {beginAgentRun} from "@/features/agent/commands/agentRuns";
import {createChatThread} from "@/features/agent/commands/chat";
import {recoverAbandonedRuns, type ThreadLockManager} from "@/features/agent/runtime/runOwnership";
import {useChatExecutionSession} from "@/features/agent/ui/useChatExecutionSession";
import {ErrorFallbackView} from "@/app/errors/ErrorFallback";
import type {ConnectorConfig} from "@/features/settings/models/connector";

(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

const connector: ConnectorConfig = {id: "boundary-cx", name: "t", definitionId: "openai-compatible", baseUrl: "https://example.test/v1", apiKey: "k", updatedAt: "2026-01-01"};
const freeLocks: ThreadLockManager = {request: (_name, _options, callback) => callback({})};
const heldLocks: ThreadLockManager = {request: (_name, _options, callback) => callback(null)};

describe("error boundary unmounting the chat page", () => {
    it("aborts the in-flight execution through the real cleanup hook", async () => {
        let aborted = false;
        let lockHeld = false;
        function Probe() {
            const session = useChatExecutionSession("thread-a");
            const acquire = useRef(session.acquire);
            useEffect(() => {
                const token = acquire.current()!;
                token.controller.signal.addEventListener("abort", () => { aborted = true; });
                lockHeld = session.sendLockRef.current;
            }, []);
            return null;
        }
        const container = document.createElement("div");
        const root = createRoot(container);
        await act(async () => { root.render(h(Probe)); });
        expect(lockHeld).toBe(true);
        expect(aborted).toBe(false);
        await act(async () => { root.unmount(); });
        expect(aborted).toBe(true);
    });

    it("leaves a running run persisted and recovery marks it interrupted without losing messages", async () => {
        const thread = await createChatThread();
        const run = await beginAgentRun({threadId: thread.id, connector, model: "m", content: "请继续"});
        expect((await db.agentRuns.get(run.id))?.status).toBe("running");

        // Another page still owns the thread lock: recovery must not touch the run.
        await recoverAbandonedRuns(heldLocks);
        expect((await db.agentRuns.get(run.id))?.status).toBe("running");

        // Remount after the boundary retry: the abandoned run becomes interrupted.
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
