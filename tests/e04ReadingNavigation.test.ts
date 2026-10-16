// @vitest-environment jsdom
import {act, createElement as h, type ReactNode} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {ChatMessage} from "@/features/agent/models/chat";
import type {AgentRun} from "@/features/agent/models/agent";
import {createSubmissionAttempt, type ChatSubmissionAttempt} from "@/features/agent/models/chatSubmissionAttempt";

vi.mock("@/platform/product/queries", () => ({useProductQuery: () => []}));
vi.mock("@lobehub/ui", () => ({
    CopyButton: () => h("button", {type: "button"}, "复制"),
    Text: ({children}: {children?: ReactNode}) => h("span", null, children),
}));
vi.mock("@/features/agent/ui/AgentMarkdown", () => ({AgentMarkdown: ({children}: {children?: ReactNode}) => h("div", null, children)}));
vi.mock("@/features/agent/ui/ModelIcons", () => ({ModelIcon: () => null}));
vi.mock("@/features/agent/ui/ReferenceAttachments", () => ({ReferenceMessageSources: () => null, ReferenceAttachments: () => null}));
vi.mock("@/features/agent/ui/MemoryContextDetails", () => ({MemoryRunHistory: () => null}));
vi.mock("@/features/agent/ui/ThinkingMatrix", () => ({ThinkingMatrix: () => null}));
vi.mock("@/features/agent/ui/ThinkingPanel", () => ({ThinkingPanel: () => null}));
vi.mock("@/features/agent/ui/AgentRunDetails", () => ({AgentRunDetails: () => h("div", {className: "agent-execution-activity"},
    h("button", {type: "button"}, "展开过程"))}));
import {MessageList} from "@/features/agent/ui/MessageList";
import {AgentActivityNavigationProvider, useAgentActivityNavigation} from "@/features/agent/ui/AgentActivityNavigation";

const createdAt = "2026-10-15T12:00:00.000Z";
function user(id: string, threadId = "thread"): ChatMessage {
    return {id, threadId, role: "user", content: `问题 ${id}`, status: "complete", createdAt};
}
function answer(id = "answer", content = "正在增长的回复"): ChatMessage {
    return {id, threadId: "thread", role: "assistant", content, status: "streaming", createdAt};
}
function RevealActivity() {
    const {reveal} = useAgentActivityNavigation();
    return h("button", {type: "button", "data-reveal": true, onClick: () => reveal({runId: "run"})}, "查看过程");
}

type ControlledResize = {callback: ResizeObserverCallback; targets: Set<Element>};
let root: Root, container: HTMLDivElement;
let height: number;
let resizeObservers: Set<ControlledResize>;
let frames: Map<number, FrameRequestCallback>;
const noop = () => undefined;
async function render(messages: ChatMessage[], extra: {threadId?: string; submissions?: ChatSubmissionAttempt[]; runs?: AgentRun[]} = {}) {
    const threadId = extra.threadId ?? "thread";
    await act(async () => root.render(h(AgentActivityNavigationProvider, {threadId, children: [
        h(RevealActivity, {key: "reveal"}),
        h(MessageList, {key: "messages", threadId, messages, submissions: extra.submissions, runs: extra.runs,
            busy: false, onRunAction: noop}),
    ]})));
}
function viewport() {return container.querySelector<HTMLDivElement>(".agent-message-list")!;}
function latest() {return container.querySelector<HTMLButtonElement>(".agent-return-to-latest");}
async function scrollTo(top: number) {
    await act(async () => {viewport().scrollTop = top; viewport().dispatchEvent(new Event("scroll"));});
}
async function resize() {
    const content = container.querySelector(".agent-message-list > .agent-content")!;
    await act(async () => {
        for (const observer of resizeObservers) if (observer.targets.has(content)) observer.callback([], {} as ResizeObserver);
    });
}
async function runFrames() {
    const pending = [...frames.values()]; frames.clear();
    await act(async () => {for (const callback of pending) callback(0);});
}

beforeEach(() => {
    height = 4000; resizeObservers = new Set(); frames = new Map();
    const positions = new WeakMap<HTMLElement, number>();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("ResizeObserver", class implements ControlledResize {
        targets = new Set<Element>();
        constructor(readonly callback: ResizeObserverCallback) {resizeObservers.add(this);}
        observe(target: Element) {this.targets.add(target);}
        unobserve(target: Element) {this.targets.delete(target);}
        disconnect() {this.targets.clear(); resizeObservers.delete(this);}
    });
    let frame = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {frames.set(++frame, callback); return frame;});
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function (this: HTMLElement) {return this.classList.contains("agent-message-list") ? height : 0;});
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) {return this.classList.contains("agent-message-list") ? 500 : 0;});
    vi.spyOn(HTMLElement.prototype, "scrollTop", "get").mockImplementation(function (this: HTMLElement) {return positions.get(this) ?? 0;});
    vi.spyOn(HTMLElement.prototype, "scrollTop", "set").mockImplementation(function (this: HTMLElement, value: number) {
        positions.set(this, this.classList.contains("agent-message-list") ? Math.max(0, Math.min(height - 500, value)) : value);
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
        const index = this.hasAttribute("data-turn-anchor") ? [...this.parentElement!.querySelectorAll("[data-turn-anchor]")].indexOf(this) : 0;
        const top = this.hasAttribute("data-turn-anchor") ? index * 600 - (container.querySelector(".agent-message-list")?.scrollTop ?? 0) : 0;
        return {x: 0, y: top, top, left: 0, right: 600, bottom: top + 500, width: 600, height: 500, toJSON: () => ({})};
    });
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    expect(resizeObservers.size).toBe(0); expect(frames.size).toBe(0);
    container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe("E04 local reading intent", () => {
    it("keeps a paused reader in place through answer growth and the pending initial frame", async () => {
        await render([user("u1"), answer()]);
        expect(viewport().scrollTop).toBe(3500); expect(latest()).toBeNull();
        await scrollTo(200);
        expect(latest()?.getAttribute("aria-label")).toBe("返回最新");
        expect(latest()?.textContent).toBe("");
        expect(latest()?.querySelector("svg[aria-hidden=true]")).toBeTruthy();
        await runFrames(); expect(viewport().scrollTop).toBe(200);
        await render([user("u1"), answer("answer", "更多输出")]);
        height = 4800; await resize(); await runFrames();
        expect(viewport().scrollTop).toBe(200);
        expect(container.querySelectorAll(".agent-return-to-latest")).toHaveLength(1);
        expect(container.querySelector(".agent-submission-status")).toBeNull();
    });

    it("returns immediately through one native button, preserves focus, and follows later resize", async () => {
        await render([user("u1"), answer()]); await scrollTo(400);
        const button = latest()!; expect(button.type).toBe("button"); button.focus();
        const focus = vi.spyOn(viewport(), "focus");
        await act(async () => button.click());
        expect(viewport().scrollTop).toBe(3500); expect(latest()).toBeNull();
        expect(document.activeElement).toBe(viewport()); expect(focus).toHaveBeenCalledWith({preventScroll: true});
        const other = container.querySelector<HTMLButtonElement>("[data-reveal]")!; other.focus(); focus.mockClear();
        height = 4600; await resize();
        expect(viewport().scrollTop).toBe(4100); expect(document.activeElement).toBe(other); expect(focus).not.toHaveBeenCalled();
    });

    it("keeps the existing 300px threshold and resumes through ordinary scroll intent", async () => {
        await render([user("u1"), answer()]);
        await scrollTo(3199); expect(latest()).toBeTruthy();
        await scrollTo(3200); expect(latest()).toBeNull();
        height = 4500; await resize(); expect(viewport().scrollTop).toBe(4000);
    });

    it("does not resume at same-ID optimistic acknowledgement but does for a new user turn", async () => {
        const captured = createSubmissionAttempt({originThreadId: "thread", submitted: {scope: "thread", text: "提交内容", textRevision: 1, attachments: [], imports: []},
            recovery: {scope: "thread", revision: 2}, connector: {id: "connector", definitionId: "openai-compatible", baseUrl: "https://unused.invalid"},
            model: "model", taskMode: false, interactionMode: "smart"});
        captured.createdAt = "2026-10-15T12:01:00.000Z";
        await render([user("u1")], {submissions: [captured]}); await scrollTo(250);
        const canonical = {...user(captured.admission.userMessageId), content: "提交内容", createdAt: captured.createdAt};
        await render([user("u1"), canonical], {submissions: [{...captured, phase: "accepted"}]});
        height = 4400; await resize();
        expect(viewport().scrollTop).toBe(250); expect(latest()).toBeTruthy();
        expect(container.textContent?.match(/提交内容/g)).toHaveLength(1);
        await render([user("u1"), canonical, user("new-turn")]);
        expect(viewport().scrollTop).toBe(3900); expect(latest()).toBeNull();
    });

    it("uses explicit topic identity instead of the first row for thread entry reset", async () => {
        await render([answer("first")]); await scrollTo(180);
        await render([answer("replacement")]); expect(viewport().scrollTop).toBe(180); expect(latest()).toBeTruthy();
        await render([], {threadId: "other-thread"});
        expect(viewport().scrollTop).toBe(3500); expect(latest()).toBeNull();
    });

    it("pauses for an actual rail jump and activity navigation until fresh scroll intent", async () => {
        const messages = Array.from({length: 5}, (_, index) => user(`u${index}`));
        await render(messages);
        const firstTurn = container.querySelector<HTMLButtonElement>(".agent-turn-tick")!;
        await act(async () => firstTurn.click()); expect(latest()).toBeTruthy();
        const chosenPosition = viewport().scrollTop;
        height = 4600; await resize(); await runFrames(); expect(viewport().scrollTop).toBe(chosenPosition);
        // A programmatic rail scroll remains an explicit pause, even within the threshold.
        await scrollTo(4000); expect(latest()).toBeTruthy();
        await act(async () => viewport().dispatchEvent(new Event("wheel", {bubbles: true})));
        await scrollTo(4000); expect(latest()).toBeNull();
        await act(async () => container.querySelector<HTMLButtonElement>("[data-reveal]")!.click());
        expect(latest()).toBeTruthy();
        height = 5000; await resize(); expect(viewport().scrollTop).toBe(4000);
    });

    it("keeps disclosure pointer and keyboard activation as explicit reading pauses", async () => {
        const run: AgentRun = {id: "run", threadId: "thread", agentId: "agent", agentSnapshot: {name: "助手", instructions: ""},
            userMessageId: "u1", assistantMessageId: "answer", model: "model", connector: {id: "connector", definitionId: "openai-compatible", baseUrl: "https://unused.invalid"},
            requestMessages: [], status: "running", checkpoint: 1, createdAt, updatedAt: createdAt};
        await render([user("u1"), {...answer(), runId: "run"}], {runs: [run]});
        const disclosure = container.querySelector<HTMLButtonElement>(".agent-execution-activity button")!;
        await act(async () => disclosure.dispatchEvent(new MouseEvent("pointerdown", {bubbles: true})));
        expect(latest()).toBeTruthy();
        await act(async () => latest()!.click()); expect(latest()).toBeNull();
        disclosure.focus();
        await act(async () => disclosure.dispatchEvent(new KeyboardEvent("keydown", {key: "Enter", bubbles: true})));
        expect(latest()).toBeTruthy();
        const position = viewport().scrollTop; height += 500; await resize(); expect(viewport().scrollTop).toBe(position);
    });
});
