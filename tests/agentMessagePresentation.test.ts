// @vitest-environment jsdom
import {act, createElement as h, type ReactNode} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {AgentRun, AgentToolCall} from "@/features/agent/models/agent";
import type {ChatMessage} from "@/features/agent/models/chat";

let callsFixture: AgentToolCall[] = [];
let writesFixture: {total: number; groups: Array<{label: string; count: number}>; entries: unknown[]; omitted: number; uncoveredCalls: number} =
    {total: 0, groups: [], entries: [], omitted: 0, uncoveredCalls: 0};

vi.mock("@lobehub/ui", () => ({
    Markdown: ({children}: {children?: ReactNode}) => h("div", {"data-md": ""}, children),
    CopyButton: () => h("button", {type: "button"}, "复制"),
    Text: ({children}: {children?: ReactNode}) => h("span", null, children),
}));
vi.mock("@/features/agent/ui/ModelIcons", () => ({ModelIcon: () => null}));
vi.mock("@/features/agent/ui/ReferenceAttachments", () => ({ReferenceMessageSources: () => null}));
vi.mock("@/features/agent/ui/MemoryContextDetails", () => ({MemoryRunHistory: () => null}));
vi.mock("@/features/agent/ui/TurnNavigation", () => ({TurnNavigation: () => null}));
vi.mock("@/features/agent/ui/ThinkingMatrix", () => ({ThinkingMatrix: () => h("span", null, "matrix")}));
vi.mock("@/features/agent/ui/AgentGenerationResults", () => ({AgentGenerationResults: () => null}));
vi.mock("@/features/agent/ui/GenerationReview", () => ({GenerationReview: () => null}));
vi.mock("@/features/agent/ui/MusicGenerationReview", () => ({MusicGenerationReview: () => null}));
vi.mock("@/features/agent/ui/WebResearchSources", () => ({WebResearchSources: () => null}));
vi.mock("@/features/agent/ui/ProjectImageSources", () => ({ProjectImageSources: () => null}));
vi.mock("@/features/agent/ui/CreatedEntityLinks", () => ({CreatedEntityLinks: () => null}));
vi.mock("@tanstack/react-router", () => ({Link: ({children}: {children?: ReactNode}) => h("a", null, children)}));
vi.mock("@/features/agent/runtime/runWriteOutcomes", async importOriginal => ({
    ...(await importOriginal<typeof import("@/features/agent/runtime/runWriteOutcomes")>()),
    describeRunWrites: () => writesFixture,
}));

const {MessageList, presentMessageStatus} = await import("@/features/agent/ui/MessageList");

const now = "2026-10-13T00:00:00.000Z";
const user: ChatMessage = {id: "u1", threadId: "t1", role: "user", content: "你好", createdAt: now, status: "complete"};
function assistant(patch: Partial<ChatMessage> = {}): ChatMessage {
    return {id: "a1", threadId: "t1", role: "assistant", content: "这是回复", createdAt: now, status: "complete", runId: "r1", ...patch};
}
function run(patch: Partial<AgentRun> = {}): AgentRun {
    return {
        id: "r1", threadId: "t1", agentId: "g", agentSnapshot: {name: "a", instructions: ""}, userMessageId: "u1", assistantMessageId: "a1",
        model: "fixture-model", connector: {id: "c", definitionId: "d", baseUrl: "https://example.test"}, requestMessages: [],
        status: "completed", checkpoint: 1, createdAt: now, updatedAt: now, ...patch,
    } as AgentRun;
}
function toolCall(id: string, patch: Partial<AgentToolCall> = {}): AgentToolCall {
    return {
        id, runId: "r1", threadId: "t1", providerCallId: id, step: 1, order: 0, name: "business_read", title: "读取镜头",
        arguments: "{}", effect: "read", highRisk: false, status: "completed", createdAt: now, updatedAt: now, ...patch,
    };
}

let root: Root, container: HTMLDivElement;
async function render(messages: ChatMessage[], runs: AgentRun[]) {
    await act(async () => {
        root.render(h(MessageList, {threadId: "t1", messages, runs, calls: callsFixture, busy: false, onRunAction: vi.fn()}));
    });
}
const text = () => container.textContent ?? "";

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("ResizeObserver", class {observe() {} unobserve() {} disconnect() {}});
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
    callsFixture = [];
    writesFixture = {total: 0, groups: [], entries: [], omitted: 0, uncoveredCalls: 0};
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

const REMOVED_COPY = ["成果声明", "工具调用已结束", "回复已结束", "含 1 项失败", "含 2 项失败", "执行记录", "不代表", "参数校验失败", "缺少可核验记录", "（已停止）", "已保留收到的内容"];

describe("quiet successful reply", () => {
    it("shows only the body and action bar for a plain reply, with no process row", async () => {
        await render([user, assistant()], [run()]);
        expect(text()).toContain("这是回复");
        expect(text()).toContain("复制");
        expect(container.querySelector(".agent-execution-summary")).toBeNull();
        expect(container.querySelector(".agent-message-status")).toBeNull();
        for (const phrase of REMOVED_COPY) expect(text()).not.toContain(phrase);
    });

    it("adds one saved line and one tool-count line after a tool run, collapsed by default", async () => {
        callsFixture = [toolCall("c1"), toolCall("c2", {name: "shot_update", effect: "write"}), toolCall("c3", {name: "update_run_plan", effect: "bookkeeping"})];
        writesFixture = {total: 1, groups: [{label: "镜头", count: 1}], entries: [], omitted: 0, uncoveredCalls: 0};
        await render([user, assistant()], [run({hasToolCalls: true})]);
        expect(text()).toContain("用了 2 个工具");
        expect(text()).toContain("本次已保存：镜头 1 项");
        expect(container.querySelector<HTMLElement>(".agent-execution-timeline")?.hidden).toBe(true);
        for (const phrase of REMOVED_COPY) expect(text()).not.toContain(phrase);
    });

    it("shows no saved line when writes lack receipts, and no disclaimers when expanded", async () => {
        callsFixture = [toolCall("c2", {name: "shot_update", effect: "write"})];
        writesFixture = {total: 0, groups: [], entries: [], omitted: 0, uncoveredCalls: 1};
        await render([user, assistant()], [run({hasToolCalls: true})]);
        expect(text()).not.toContain("已保存");
        expect(text()).not.toContain("可核验");
        writesFixture = {total: 1, groups: [{label: "镜头", count: 1}], entries: [], omitted: 0, uncoveredCalls: 2};
        await render([user, assistant()], [run({hasToolCalls: true, updatedAt: "2026-10-13T00:00:01.000Z"})]);
        expect(text()).toContain("本次已保存");
        for (const phrase of ["后续编辑可能改变内容", "不代表没有产生修改"]) expect(text()).not.toContain(phrase);
    });

    it("keeps model, speed and tokens out of the default action bar except as hover-only info", async () => {
        await render([user, assistant()], [run({outputTokensPerSecond: 12.3, usage: {totalTokens: 900}})]);
        const info = container.querySelector(".agent-message-hover-info");
        expect(info?.textContent).toContain("tok/s");
        expect(container.querySelector(".agent-message-meta")?.querySelectorAll(":scope > button").length).toBe(1);
    });

    it("does not put an avatar or title on either side", async () => {
        await render([user, assistant()], [run()]);
        expect(container.querySelector("img, [class*=avatar]")).toBeNull();
        expect(container.querySelector(".agent-user-bubble")?.textContent).toBe("你好");
    });
});

describe("failure and stop", () => {
    it("tells a failed or interrupted turn only in the composer bubble, never in the stream", async () => {
        const failed = assistant({status: "error", error: "模型服务返回 500", content: ""});
        await render([user, failed], [run({status: "failed"})]);
        expect(text()).not.toContain("模型服务返回 500");
        expect(text()).not.toContain("重新生成");
        // Only a bare marker remains so a content-less failed turn can still be read; no reason, no action.
        expect(container.querySelector(".agent-message-error")).toBeNull();
        expect(container.querySelector(".agent-message-status")?.textContent).toBe("未完成");
        await render([user, assistant({status: "interrupted", error: "执行已中断。继续时将使用已保存的步骤与结果", content: ""})], [run({status: "interrupted"})]);
        expect(text()).not.toContain("已保存的步骤");
        await render([user, assistant({status: "error", error: "x", content: "已有部分内容"})], [run({status: "failed"})]);
        expect(container.querySelector(".agent-message-status")).toBeNull();
        expect(container.querySelector(".agent-execution-summary")).toBeNull();
        for (const phrase of REMOVED_COPY) expect(text()).not.toContain(phrase);
    });

    it("shows a stopped reply as just 已停止", async () => {
        await render([user, assistant({status: "aborted", content: ""})], [run({status: "cancelled"})]);
        expect(text().match(/已停止/g)).toHaveLength(1);
        expect(text()).not.toContain("（已停止）");
        expect(text()).not.toContain("已保留收到的内容");
    });

    it("maps statuses to one quiet line", () => {
        expect(presentMessageStatus({status: "complete", content: "x"})).toBeUndefined();
        expect(presentMessageStatus({status: "aborted", content: ""})).toEqual({text: "已停止", tone: "muted"});
        expect(presentMessageStatus({status: "error", content: ""})).toEqual({text: "未完成", tone: "muted"});
        expect(presentMessageStatus({status: "interrupted", content: "partial"})).toBeUndefined();
    });
});

describe("running", () => {
    it("shows a static in-progress marker without a ticking clock or duplicate working line", async () => {
        callsFixture = [toolCall("c1", {status: "running"})];
        await render([user, assistant({status: "streaming", content: ""})], [run({status: "running", hasToolCalls: true})]);
        const summary = container.querySelector(".agent-execution-summary")?.textContent ?? "";
        expect(summary).toContain("进行中");
        expect(summary).not.toContain("用时");
        expect(container.querySelector(".agent-activity-working")).toBeNull();
    });
});
