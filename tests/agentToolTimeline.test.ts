// @vitest-environment jsdom
import {act, createElement as h, type ReactNode} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {AgentRun, AgentToolCall} from "@/domain/agent";

let attentionCalls: AgentToolCall[] = [];
vi.mock("@/lib/storage/hooks", () => ({
    useProductQuery: () => ({threadId: "t1", calls: attentionCalls, batches: [], items: [], jobs: [], tasks: []}),
}));
vi.mock("@lobehub/ui", () => ({Markdown: ({children}: {children?: ReactNode}) => h("div", null, children)}));
vi.mock("@/components/agent/ThinkingPanel", () => ({ThinkingPanel: () => null}));
vi.mock("@/components/agent/AgentGenerationResults", () => ({AgentGenerationResults: () => h("div", {"data-testid": "results"})}));
vi.mock("@/components/agent/GenerationReview", () => ({GenerationReview: () => h("div", {"data-testid": "generation-review"})}));
vi.mock("@/components/agent/MusicGenerationReview", () => ({MusicGenerationReview: () => null}));
vi.mock("@/components/agent/WebResearchSources", () => ({WebResearchSources: () => null}));
vi.mock("@/components/agent/ProjectImageSources", () => ({ProjectImageSources: () => null}));
vi.mock("@/components/agent/CreatedEntityLinks", () => ({CreatedEntityLinks: () => null}));
vi.mock("@/components/agent/AgentWriteOutcomes", () => ({AgentWriteOutcomes: () => null}));
vi.mock("@tanstack/react-router", () => ({Link: ({children}: {children?: ReactNode}) => h("a", null, children)}));

const {AgentRunDetails} = await import("@/components/agent/AgentRunDetails");
const {AgentComposerAttention} = await import("@/components/agent/AgentComposerAttention");
const {AgentActivityNavigationProvider, useAgentActivityNavigation} = await import("@/components/agent/AgentActivityNavigation");

const now = "2026-10-13T00:00:00.000Z";
function run(patch: Partial<AgentRun> = {}): AgentRun {
    return {
        id: "r1", threadId: "t1", agentId: "g", agentSnapshot: {name: "a", instructions: ""}, userMessageId: "u1", assistantMessageId: "a1",
        model: "m", connector: {id: "c", definitionId: "d", baseUrl: "https://example.test"}, requestMessages: [],
        status: "completed", checkpoint: 1, createdAt: now, updatedAt: now, hasToolCalls: true, ...patch,
    } as AgentRun;
}
function call(id: string, patch: Partial<AgentToolCall> = {}): AgentToolCall {
    return {
        id, runId: "r1", threadId: "t1", providerCallId: id, step: 1, order: 0, name: "business_read", title: "读取镜头",
        arguments: "{}", effect: "read", highRisk: false, status: "completed", createdAt: now, updatedAt: now, ...patch,
    };
}
const message = {id: "a1", threadId: "t1", role: "assistant" as const, content: "", createdAt: now, status: "complete" as const};

let root: Root, container: HTMLDivElement;
const text = () => container.textContent ?? "";
async function renderDetails(calls: AgentToolCall[], runPatch: Partial<AgentRun> = {}, onAction = vi.fn()) {
    await act(async () => {
        root.render(h(AgentActivityNavigationProvider, {threadId: "t1"},
            h(AgentRunDetails, {run: run(runPatch), message, calls, busy: false, onAction})));
    });
    return onAction;
}
const buttons = (label: string) => [...container.querySelectorAll("button")].filter(b => (label.includes(" ") ? b.textContent?.includes(label) : b.textContent === label));

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
    attentionCalls = [];
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe("tool timeline", () => {
    it("renders one row per call without success wording or effect/badge lines", async () => {
        await renderDetails([call("c1", {title: "读取镜头"}), call("c2", {title: "读取角色", name: "character_read"}), call("c3", {title: "编辑镜头", name: "shot_update", effect: "write"})], {status: "running"});
        expect(container.querySelectorAll("[data-activity-call]")).toHaveLength(3);
        for (const phrase of ["已完成", "读取本地数据", "编辑数据", "待处理", "项失败"]) expect(text()).not.toContain(phrase);
    });

    it("merges consecutive successful calls of one kind and expands to the individual rows", async () => {
        await renderDetails([call("c1"), call("c2"), call("c3"), call("c4", {title: "读取角色", name: "character_read"})], {status: "running"});
        expect(buttons("读取镜头 · 3 项")).toHaveLength(1);
        expect(container.querySelectorAll("[data-activity-call]")).toHaveLength(4);
        const merged = container.querySelector<HTMLElement>(".agent-tool-merged > [id]");
        expect(merged?.hidden).toBe(true);
        await act(async () => buttons("读取镜头 · 3 项")[0].click());
        expect(merged?.hidden).toBe(false);
        expect(text()).toContain("读取角色");
        expect(text()).not.toContain("读取角色 · ");
    });

    it("does not merge a single call or calls separated by another kind", async () => {
        await renderDetails([call("c1"), call("c2", {title: "读取角色", name: "character_read"}), call("c3")], {status: "running"});
        expect(container.querySelector(".agent-tool-merged")).toBeNull();
    });

    it("shows a failed call's reason directly, without expanding", async () => {
        await renderDetails([call("c1", {status: "failed", error: "镜头不存在"})], {status: "running"});
        const row = container.querySelector<HTMLElement>("[data-activity-call]")!;
        expect(row.querySelector("[id]")?.hasAttribute("hidden")).toBe(true);
        expect(row.querySelector(".agent-call-error")?.textContent).toBe("镜头不存在");
    });

    it("auto-expands a pending approval with preview and decision buttons that fire onAction", async () => {
        const pending = call("c1", {
            name: "shot_update", effect: "write", status: "awaiting_approval", highRisk: true, title: "修改镜头",
            preview: {summary: "把镜头 3 改为特写", changes: ["时长 3s → 5s"]},
        } as Partial<AgentToolCall>);
        const onAction = await renderDetails([pending], {status: "waiting_approval"});
        expect(container.querySelector<HTMLElement>("[data-activity-call] > [id]")?.hidden).toBe(false);
        expect(text()).toContain("把镜头 3 改为特写");
        expect(text()).toContain("高风险操作");
        await act(async () => buttons("批准")[0].click());
        expect(onAction).toHaveBeenCalledWith("r1", "approve", "c1");
        await act(async () => buttons("拒绝")[0].click());
        expect(onAction).toHaveBeenCalledWith("r1", "reject", "c1");
    });

    it("keeps approval buttons visible even when the row is folded", async () => {
        await renderDetails([call("c1", {status: "awaiting_approval", effect: "write", name: "shot_update"})], {status: "waiting_approval"});
        await act(async () => container.querySelector<HTMLButtonElement>(".agent-tool-call-toggle")!.click());
        expect(container.querySelector<HTMLElement>("[data-activity-call] > [id]")?.hidden).toBe(true);
        expect(buttons("批准")).toHaveLength(1);
    });

    it("keeps the generation review mounted for paid submission approval", async () => {
        await renderDetails([call("c1", {name: "submit_generation", effect: "network", status: "awaiting_approval"})], {status: "waiting_approval"});
        expect(container.querySelector("[data-testid=generation-review]")).not.toBeNull();
        expect(container.querySelector("[data-testid=results]")).not.toBeNull();
        expect(buttons("批准")).toHaveLength(0);
    });

    it("shows an unknown result once, on the call row, without a second banner", async () => {
        await renderDetails([call("c1", {status: "unknown"})], {status: "running"});
        expect(text().match(/结果待核实/g)).toHaveLength(1);
        expect(text()).not.toContain("已暂停自动接续");
    });
});

describe("composer attention", () => {
    it("points to a pending approval without its own approve/reject buttons and requests navigation", async () => {
        const pending = call("c1", {status: "awaiting_approval", effect: "write", name: "shot_update", title: "修改镜头"});
        attentionCalls = [pending];
        let seen: {runId: string; callId?: string} | null = null;
        function Probe() {
            seen = useAgentActivityNavigation().request;
            return null;
        }
        await act(async () => {
            root.render(h(AgentActivityNavigationProvider, {threadId: "t1"}, h(Probe), h(AgentComposerAttention, {
                threadId: "t1", runs: [run({status: "waiting_approval"})], messages: [], projectUnavailable: false, onOpenTask: vi.fn(),
            })));
        });
        expect(text()).toContain("待批准");
        expect(buttons("批准")).toHaveLength(0);
        expect(buttons("拒绝")).toHaveLength(0);
        await act(async () => container.querySelector<HTMLButtonElement>(".agent-attention-list button")!.click());
        expect(seen).toMatchObject({runId: "r1", callId: "c1"});
    });
});
