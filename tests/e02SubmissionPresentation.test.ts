// @vitest-environment jsdom
import {act, createElement as h, useEffect, type ReactNode} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {ChatMessage} from "@/features/agent/models/chat";
import type {ComposerProps} from "@/features/agent/ui/composerTypes";
import {createSubmissionAttempt, submissionTranscript, visibleSubmissionAttempts} from "@/features/agent/models/chatSubmissionAttempt";
import {yieldSubmissionPaint} from "@/features/agent/ui/chatSubmissionAttempts";

const reading = vi.hoisted(() => ({messages: [] as ChatMessage[]}));
vi.mock("@/platform/product/queries", () => ({useProductQueryState: () => ({value: {threadId: "thread", messages: reading.messages, runs: [], calls: [], observedRevision: 0}, error: null})}));
vi.mock("@/features/agent/ui/ExecutionFeedback", async original => ({...await original<typeof import("@/features/agent/ui/ExecutionFeedback")>(),
    ThreadExecutionFeedbackProvider: ({children}: {children?: ReactNode}) => children}));
const rich = vi.hoisted(() => {
    let release!: () => void;
    return {gate: new Promise<void>(resolve => {release = resolve;}), release: () => release()};
});
vi.mock("@/features/agent/ui/MessageList", async () => {
    await rich.gate;
    const {createElement, useLayoutEffect} = await import("react");
    return {MessageList: ({messages, submissions, onSubmissionObserved}: {
        messages: ChatMessage[]; submissions: ReturnType<typeof createSubmissionAttempt>[]; onSubmissionObserved?: (id: string) => void;
    }) => {
        useLayoutEffect(() => {for (const attempt of submissions) if (messages.some(message => message.id === attempt.admission.userMessageId)) onSubmissionObserved?.(attempt.admission.userMessageId);}, [messages, submissions, onSubmissionObserved]);
        return createElement("div", {"data-rich-transcript": true}, messages.map(message => createElement("div", {key: message.id}, message.content)));
    }};
});
vi.mock("@lobehub/ui", async () => {
    const {createElement} = await import("react");
    return {Flexbox: ({children, className, style}: {children?: ReactNode; className?: string; style?: object}) => createElement("div", {className, style}, children)};
});
vi.mock("@/app/layout/ModuleLayout", async () => {
    const {createElement} = await import("react");
    return {ModuleLayout: ({children}: {children?: ReactNode}) => createElement("div", null, children)};
});
vi.mock("@/features/agent/ui/AgentHeader", () => ({AgentHeader: () => null}));
vi.mock("@/features/agent/ui/AgentTopicNavigation", () => ({useAgentTopicNavigation: () => ({})}));
vi.mock("@/features/agent/ui/AgentActivityNavigation", () => ({useAgentActivityNavigation: () => ({})}));
vi.mock("@/features/agent/ui/FloatingComposer", async () => {
    const {createElement} = await import("react");
    return {FloatingComposer: ({value}: ComposerProps) => createElement("textarea", {"aria-label": "next draft", value, readOnly: true})};
});
vi.mock("@/features/agent/ui/ReferenceAttachments", async () => {
    const {createElement} = await import("react");
    return {ReferenceAttachments: ({attachments}: {attachments: Array<{referenceId: string; revision: number}>}) => createElement("div", null,
        attachments.map(attachment => createElement("span", {key: attachment.referenceId, "data-reference": `${attachment.referenceId}@${attachment.revision}`}, "参考资料")))};
});
import {ChatWorkspace} from "@/features/agent/ui/ChatWorkspace";
import {SubmissionMessage} from "@/features/agent/ui/SubmissionMessage";

function attempt(text = "captured message") {
    return createSubmissionAttempt({originThreadId: "thread", projectId: "project", submitted: {scope: "thread", text, textRevision: 1,
        attachments: [{referenceId: "ref", revision: 7}], imports: []}, recovery: {scope: "thread", revision: 2},
        connector: {id: "connector", definitionId: "openai-compatible", baseUrl: "https://unused.invalid"}, model: "model", taskMode: false, interactionMode: "smart"});
}
function message(id: string, createdAt: string, threadId = "thread"): ChatMessage {
    return {id, threadId, createdAt, role: "user", content: "durable", status: "complete"};
}

describe("E02 canonical presentation join", () => {
    it("preserves chronological failed candidates and joins only exact owned user identity", () => {
        const failed = {...attempt("first failed"), createdAt: "2026-10-15T10:00:00.000Z", phase: "failed" as const};
        const accepted = {...attempt("later"), createdAt: "2026-10-15T10:02:00.000Z", phase: "accepted" as const};
        const rows = [message("older", "2026-10-15T09:00:00.000Z"), message(accepted.admission.userMessageId, "2026-10-15T10:03:00.000Z")];
        const projection = submissionTranscript(rows, [failed, accepted]);
        expect(projection.map(entry => entry.kind === "attempt" ? entry.attempt.submitted.text : entry.message.id)).toEqual(["older", "first failed", accepted.admission.userMessageId]);
        expect(visibleSubmissionAttempts([failed], [message(failed.admission.userMessageId, failed.createdAt, "foreign")])).toEqual([failed]);
    });
    it("receipt before observation keeps the row, observation before receipt removes duplicate by identity", () => {
        const captured = attempt();
        expect(visibleSubmissionAttempts([{...captured, phase: "accepted"}], [])).toHaveLength(1);
        expect(visibleSubmissionAttempts([captured], [message(captured.admission.userMessageId, captured.createdAt)])).toHaveLength(0);
        expect(visibleSubmissionAttempts([captured], [message("different", captured.createdAt)])).toHaveLength(1);
    });
});

let root: Root, container: HTMLDivElement;
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("ResizeObserver", class {observe() {} disconnect() {}});
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => {await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals();});

it("actual React DOM keeps the eager echo through cold rich loading and accepted observation, retaining the composer owner", async () => {
    const captured = attempt("<literal> captured text");
    const mounted = vi.fn(), unmounted = vi.fn(), observed = vi.fn();
    const composer = {value: "newer independent draft", sending: true, projects: [], projectId: "project"} as unknown as ComposerProps;
    function Owner({messages, accepted}: {messages: ChatMessage[]; accepted?: boolean}) {
        useEffect(() => {mounted(); return () => {unmounted();};}, []);
        reading.messages = messages;
        return h(ChatWorkspace, {threads: [], activeThreadId: "thread", ownerId: "thread", submissions: [{...captured, phase: accepted ? "accepted" : "preparing"}],
            composer, onSubmissionObserved: observed, onRetryRun: vi.fn(), onRunAction: vi.fn(), onOpenTask: vi.fn(), onOpenTasks: vi.fn(), onSelectThread: vi.fn(),
            onNewTopic: vi.fn(), onRenameThread: vi.fn(), onDeleteThread: vi.fn()});
    }
    await act(async () => root.render(h(Owner, {messages: []})));
    expect(container.textContent).toContain("<literal> captured text");
    expect(container.querySelector("literal")).toBeNull(); expect(container.querySelector('[data-reference="ref@7"]')).toBeTruthy();
    expect(container.querySelector(".agent-submission-status")).toBeNull();
    const input = container.querySelector("textarea"); expect(input?.value).toBe("newer independent draft");
    const rows = [message(captured.admission.userMessageId, captured.createdAt)]; rows[0].content = "<literal> captured text";
    await act(async () => root.render(h(Owner, {messages: rows, accepted: true})));
    expect(container.querySelector("[data-rich-transcript]")).toBeNull();
    expect(container.textContent).toContain("<literal> captured text"); expect(observed).not.toHaveBeenCalled();
    expect(container.querySelector(".agent-submission-status")).toBeNull();
    expect(container.querySelector("textarea")).toBe(input);
    await act(async () => {rich.release(); await rich.gate;});
    expect(container.querySelector("[data-rich-transcript]")).toBeTruthy();
    expect(container.textContent?.match(/<literal> captured text/g)).toHaveLength(1);
    expect(observed).toHaveBeenCalledWith(captured.admission.userMessageId);
    expect(container.querySelector("textarea")).toBe(input); expect(mounted).toHaveBeenCalledTimes(1); expect(unmounted).not.toHaveBeenCalled();
});

it("only actionable uncertainty and recovery display status beside a submitted bubble", async () => {
    const captured = attempt("one sent message");
    const action = vi.fn();
    await act(async () => root.render(h(SubmissionMessage, {attempt: {...captured, phase: "uncertain"}, busy: false, onAction: action})));
    expect(container.querySelector("button")?.textContent).toBe("核对发送状态");
    await act(async () => root.render(h(SubmissionMessage, {attempt: {...captured, phase: "accepted", recoveryRequired: true}, busy: false, onAction: action})));
    expect(container.querySelector("button")?.textContent).toBe("查看恢复选项");
    await act(async () => container.querySelector("button")?.click());
    expect(action).toHaveBeenCalledWith(captured.admission.userMessageId, "recover");
    await act(async () => root.render(h(SubmissionMessage, {attempt: {...captured, phase: "accepted"}, busy: false, onAction: action})));
    expect(container.querySelector(".agent-submission-status")).toBeNull();
    expect(container.textContent).toContain("one sent message");
});

it("render opportunity waits through two animation frames", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {frames.push(callback); return frames.length;});
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const prepared = vi.fn(); const pending = yieldSubmissionPaint().then(prepared);
    await Promise.resolve(); expect(prepared).not.toHaveBeenCalled();
    frames[0](0); await Promise.resolve(); expect(prepared).not.toHaveBeenCalled();
    frames[1](16); await pending; expect(prepared).toHaveBeenCalledTimes(1);
});

it("hidden-document rendering opportunity uses the bounded fallback without scheduling frames", async () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    const request = vi.fn();
    vi.stubGlobal("requestAnimationFrame", request); vi.stubGlobal("cancelAnimationFrame", vi.fn());
    try {
        const prepared = vi.fn(); const pending = yieldSubmissionPaint().then(prepared);
        await vi.advanceTimersByTimeAsync(79); expect(prepared).not.toHaveBeenCalled();
        expect(request).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1); await pending; expect(prepared).toHaveBeenCalledTimes(1);
    } finally {visibility.mockRestore(); vi.useRealTimers();}
});
