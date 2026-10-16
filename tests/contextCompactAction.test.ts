// @vitest-environment jsdom
import {act, createElement as h} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {db} from "@/platform/product/store";
import {createChatThread} from "@/features/agent/commands/chat";
import {updateContextPolicy} from "@/features/agent/commands/contextSettings";
import {upsertConnector} from "@/features/settings/commands/connectors";
import {DEFAULT_CONTEXT_POLICY} from "@/features/agent/runtime/contextPolicy";
import {CompactAction} from "@/features/agent/ui/ContextUsagePanel";
import type {ContextCompaction} from "@/features/agent/models/context";

let root: Root, container: HTMLDivElement;
beforeEach(() => {
    (globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals();
});
const button = (label: string) => [...container.querySelectorAll("button")].find(item => item.getAttribute("aria-label") === label || item.textContent === label) as HTMLButtonElement | undefined;
async function settle() {await act(async () => {await new Promise(resolve => setTimeout(resolve, 30));});}

it("disables with a reason, shows progress with Cancel, reports typed failures and the before → after result", async () => {
    const connector = await upsertConnector({definitionId: "openai-compatible", protocol: "openai-compatible", baseUrl: "https://example.test/v1", apiKey: "secret-key"});
    const thread = await createChatThread();
    await updateContextPolicy(thread.id, {...DEFAULT_CONTEXT_POLICY, customContextTokens: 16000});
    const render = (props: Partial<Parameters<typeof CompactAction>[0]> = {}) => act(async () => root.render(
        h(CompactAction, {threadId: thread.id, connector, model: "unknown-model", ...props})));

    await render({blocked: "执行中或待确认，结束后可整理"});
    expect(button("压缩上下文")!.disabled).toBe(true);
    expect(container.textContent).toContain("执行中或待确认");

    // Nothing to compact: a typed failure appears as an alert, not a toast or success.
    await render();
    await act(async () => button("压缩上下文")!.click());
    await settle();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("没有更多可整理的完整对话。");

    await db.chatMessages.bulkAdd(Array.from({length: 8}, (_, i) => ({id: `m${i}`, threadId: thread.id, role: i % 2 ? "assistant" : "user", content: `${i}: ${"x".repeat(900)}`, status: "complete", createdAt: new Date(1000 + i).toISOString()}) as never));
    const gate = Promise.withResolvers<Response>();
    const requested = Promise.withResolvers<void>();
    vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init?: RequestInit) => {
        init?.signal?.addEventListener("abort", () => gate.reject(new DOMException("stopped", "AbortError")), {once: true});
        requested.resolve();
        return gate.promise;
    }));
    await render();
    await act(async () => button("压缩上下文")!.click());
    expect(button("取消压缩")).toBeDefined();
    expect(button("压缩上下文")).toBeUndefined();
    await act(async () => {await requested.promise;});
    await act(async () => button("取消压缩")!.click());
    await settle();
    expect(button("压缩上下文")).toBeDefined();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect((await db.contextCompactions.toArray())[0].status).toBe("interrupted");

    const record = {status: "completed", origin: "manual", requestBefore: 5200, requestAfter: 1300} as ContextCompaction;
    await render({lastRecord: record});
    expect(container.textContent).toContain("5.2K → 1.3K");
});
