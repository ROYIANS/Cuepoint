// @vitest-environment jsdom
import {act, createElement as h, StrictMode, useCallback, useSyncExternalStore, type ReactNode} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {db} from "@/platform/product/store";
import {beginAgentRun} from "@/features/agent/commands/agentRuns";
import {admitAgentJob, checkpointAgentJob, markAgentJobRunning, publishAgentJob} from "@/features/agent/commands/agentJobs";
import {transitionToolCall} from "@/features/agent/commands/agentTools";
import {saveFixtureToolRound} from "./helpers/toolDispatch";
import {TABLE_NAMES} from "@/platform/storage/schema";
import {prepareThreadActivityKey} from "@/features/agent/commands/threadActivity";
import {createTopicActivity} from "@/features/agent/queries/threadActivity";
import {readThreadTranscript} from "@/features/agent/queries/threadReading";
import {readablePublicElement, createObservedReadQueue} from "@/features/agent/ui/threadReadVisibility";
import {nativeWindowState} from "@/platform/runtime/desktopLifecycle";
import type {ChatMessage} from "@/features/agent/models/chat";
vi.mock("@lobehub/ui", () => ({CopyButton: () => null, Text: "span"}));
vi.mock("@/features/agent/ui/AgentMarkdown", () => ({AgentMarkdown: ({children}: {children?: ReactNode}) => h("p", null, children)}));
vi.mock("@/features/agent/ui/ModelIcons", () => ({ModelIcon: () => null}));
vi.mock("@/features/agent/ui/ReferenceAttachments", () => ({ReferenceMessageSources: () => null, ReferenceAttachments: () => null}));
vi.mock("@/features/agent/ui/MemoryContextDetails", () => ({MemoryRunHistory: () => null}));
vi.mock("@/features/agent/ui/ThinkingMatrix", () => ({ThinkingMatrix: () => null}));
vi.mock("@/features/agent/ui/ThinkingPanel", () => ({ThinkingPanel: () => null}));
vi.mock("@/features/agent/ui/AgentRunDetails", () => ({AgentRunDetails: () => null}));
import {MessageList} from "@/features/agent/ui/MessageList";
import {AgentJobReport} from "@/features/agent/ui/AgentJobReport";
import {createAgentExecutionService} from "@/features/agent/runtime/agentExecutionService";
import {createSubmissionAttempt} from "@/features/agent/models/chatSubmissionAttempt";

const at = "2026-10-16T00:00:00Z";
const identity = prepareThreadActivityKey("A");
let root: Root, container: HTMLDivElement, frames: Map<number, FrameRequestCallback>, lastTextTop: number;
const rect = (top = 0, bottom = top + 20) => ({x: 0, y: top, top, left: 0, right: 300, bottom, width: 300, height: bottom - top, toJSON: () => ({})});
async function putActivity(publicRevision: number, readRevision = 0, reports: unknown[] = []) {
    await db.deviceSettings.put({key: identity.key, updatedAt: at, value: {version: 1, threadId: "A", publicRevision, readRevision, reports}});
}
async function readActivity() {return (await db.deviceSettings.get(identity.key))!.value as {publicRevision: number; readRevision: number; reports: Array<{readRevision: number}>};}
async function paint() {
    for (let i = 0; i < 2; i++) {const pending = [...frames.values()]; frames.clear(); await act(async () => pending.forEach(callback => callback(0)));}
    await act(async () => {await new Promise(resolve => setTimeout(resolve, 5));});
}
const noop = () => {};
function message(revision: number, content = "Actual visible answer"): ChatMessage {return {id: "answer", threadId: "A", role: "assistant", status: "complete", content, publicRevision: revision, createdAt: at};}
async function draw(revision: number) {
    await act(async () => root.render(h("div", {className: "agent-chat-column"},
        h(MessageList, {threadId: "A", messages: [message(revision)], runs: [], busy: false, observedRevision: revision, onRunAction: noop, onRetryRun: noop}),
        h("div", {className: "agent-composer-dock"}, "Composer"))));
}
beforeEach(async () => {
    await db.chatThreads.put({id: "A", title: "A", createdAt: at, updatedAt: at});
    frames = new Map(); lastTextTop = 100; let sequence = 0;
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("ResizeObserver", class {observe() {} disconnect() {}});
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {frames.set(++sequence, callback); return sequence;});
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(() => [rect()] as unknown as DOMRectList);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
        return this.classList.contains("agent-composer-dock") ? rect(400, 500) : rect(0, 500);
    });
    Object.defineProperty(Range.prototype, "getClientRects", {configurable: true, value: function (this: Range) {
        const r = rect(lastTextTop); return {0: r, length: 1, item: () => r};
    }});
    Object.defineProperty(document, "elementFromPoint", {configurable: true, value: () => container.querySelector(".agent-assistant-transcript p") ?? container.querySelector("[data-report]")});
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => {await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();
    delete window.__TAURI_INTERNALS__;
});

describe("E11 actual reader eligibility", () => {
    it.each(["error", "aborted", "interrupted"] as const)("acknowledges a visible terminal-only %s public status without using footer controls", async status => {
        await putActivity(9);
        const terminal = {...message(9, ""), status};
        Object.defineProperty(document, "elementFromPoint", {configurable: true, value: () => container.querySelector("[data-agent-public][role='status']")});
        await act(async () => root.render(h("div", {className: "agent-chat-column"},
            h(MessageList, {threadId: "A", messages: [terminal], runs: [], busy: false, observedRevision: 9, onRunAction: noop, onRetryRun: noop}),
            h("div", {className: "agent-composer-dock"}, "Composer"))));
        expect(container.querySelector("[data-agent-public][role='status']")?.textContent).toBeTruthy();
        await paint(); expect((await readActivity()).readRevision).toBe(9);
        await putActivity(10, 9);
        await act(async () => root.render(h(MessageList, {threadId: "A", messages: [message(10, "")], runs: [], busy: false,
            observedRevision: 10, onRunAction: noop, onRetryRun: noop})));
        await paint(); expect((await readActivity()).readRevision).toBe(9);
    });
    it("acknowledges only the painted captured 41 while newer 42 stays unread", async () => {
        await putActivity(42); await draw(41);
        expect((await readActivity()).readRevision).toBe(0);
        await paint(); expect((await readActivity()).readRevision).toBe(41);
        await draw(42); await paint(); expect((await readActivity()).readRevision).toBe(42);
    });
    it("does not acknowledge a clipped last line, inert transcript, covered text or hidden/unfocused native window", async () => {
        await putActivity(5); lastTextTop = 450; await draw(5); await paint();
        expect((await readActivity()).readRevision).toBe(0);
        lastTextTop = 100;
        const surface = container.querySelector<HTMLElement>("[data-public-revision]")!;
        container.setAttribute("inert", ""); expect(readablePublicElement(surface, surface.closest(".agent-message-list"))).toBe(false); container.removeAttribute("inert");
        container.setAttribute("inert", ""); await paint(); expect((await readActivity()).readRevision).toBe(0); container.removeAttribute("inert");
        Object.defineProperty(document, "elementFromPoint", {configurable: true, value: () => document.body});
        document.dispatchEvent(new Event("visibilitychange")); await paint(); expect((await readActivity()).readRevision).toBe(0);
        Object.defineProperty(document, "elementFromPoint", {configurable: true, value: () => container.querySelector(".agent-assistant-transcript p")});
        window.__TAURI_INTERNALS__ = {invoke: vi.fn()} as unknown as NonNullable<Window["__TAURI_INTERNALS__"]>;
        nativeWindowState.update({visible: false, focused: false}); await paint(); expect((await readActivity()).readRevision).toBe(0);
        nativeWindowState.update({visible: true, focused: false}); await paint(); expect((await readActivity()).readRevision).toBe(0);
        nativeWindowState.update({visible: true, focused: true}); await paint(); expect((await readActivity()).readRevision).toBe(5);
    });
    it("does not use the 300px follow threshold as proof that the actual newest text is visible", async () => {
        await putActivity(8); await draw(8);
        const list = container.querySelector<HTMLElement>(".agent-message-list")!;
        Object.defineProperties(list, {scrollHeight: {value: 2000}, clientHeight: {value: 500}});
        await act(async () => {list.scrollTop = 100; list.dispatchEvent(new Event("scroll"));});
        await paint(); expect((await readActivity()).readRevision).toBe(0);
        await act(async () => container.querySelector<HTMLButtonElement>(".agent-return-to-latest")!.click());
        lastTextTop = 450; await paint(); expect((await readActivity()).readRevision).toBe(0);
        lastTextTop = 100; list.dispatchEvent(new Event("scroll")); await paint(); expect((await readActivity()).readRevision).toBe(8);
    });
    it("an exact historical report clears only its cursor without requiring tail following", async () => {
        const connector = {id: "connector", definitionId: "openai-compatible" as const, protocol: "openai-compatible" as const, baseUrl: "https://fixture.invalid", apiKey: "local", updatedAt: at};
        const run = await beginAgentRun({threadId: "A", connector, model: "fixture", content: "read"});
        await db.agentRuns.update(run.id, {toolLoading: undefined, enabledToolNames: ["web_read"]});
        await saveFixtureToolRound(run.id, "", [{id: "wire", type: "function", function: {name: "web_read", arguments: "{}"}}], [{title: "read", effect: "network", highRisk: false}]);
        const call = (await db.agentToolCalls.where("runId").equals(run.id).first())!;
        await transitionToolCall(run.id, call.id, ["pending"], "running");
        const context = {runId: run.id, threadId: "A", callId: call.id};
        const admitted = await admitAgentJob(context, {kind: "web_read", urls: ["https://fixture.invalid/source"]});
        let pending = await markAgentJobRunning(context, admitted.job.id, admitted.job.revision);
        pending = await checkpointAgentJob(context, pending.id, pending.revision, {completed: 1});
        await publishAgentJob(context, pending.id, pending.revision, {status: "completed", text: "Actual report"});
        const job = (await db.agentJobs.get(pending.id))!;
        await putActivity(42, 40, [{jobId: job.id, assistantMessageId: run.assistantMessageId, publicRevision: job.revision, readRevision: 0}]);
        Object.defineProperty(document, "elementFromPoint", {configurable: true, value: () => container.querySelector('pre[aria-label="报告正文"]')});
        const currentCall = (await db.agentToolCalls.get(call.id))!;
        await act(async () => root.render(h(AgentJobReport, {run, call: currentCall})));
        await vi.waitFor(() => expect(container.textContent).toContain("查看报告"));
        await paint(); expect((await readActivity()).reports[0].readRevision).toBe(0);
        const open = [...container.querySelectorAll("button")].find(button => button.textContent?.includes("查看报告"))!;
        await act(async () => open.click());
        await vi.waitFor(() => expect(container.querySelector("pre")?.textContent).toBe("Actual report"));
        await paint();
        const state = await readActivity(); expect(state.readRevision).toBe(40); expect(state.reports[0].readRevision).toBe(job.revision);
    });
});

it("coalesces only eligible observations while retaining original 41 completion", async () => {
    const requests: number[] = []; let release!: () => void;
    const observe = createObservedReadQueue(async revision => {requests.push(revision); if (revision === 41) await new Promise<void>(resolve => {release = resolve;});});
    observe(41); observe(40); observe(41); expect(requests).toEqual([41]);
    release(); await Promise.resolve(); await Promise.resolve(); expect(requests).toEqual([41]);
    observe(42); await Promise.resolve(); expect(requests).toEqual([41, 42]);
});

it("reads exact requested source rows, calls and stamped revision together", async () => {
    await putActivity(42); await db.chatMessages.put(message(41));
    const reading = await db.transaction("r", TABLE_NAMES, tx => readThreadTranscript(identity, tx));
    expect(reading.observedRevision).toBe(41); expect(reading.threadId).toBe("A"); expect(reading.calls).toEqual([]);
});

it("sidebar keeps stable semantic snapshots for repeated output/metrics and reports corrupt state conservatively", async () => {
    await putActivity(41); const source = createTopicActivity("A"), changed = vi.fn(); const stop = source.subscribe(changed);
    await vi.waitFor(() => expect(source.getSnapshot().unread).toBe(true));
    const original = source.getSnapshot(); changed.mockClear();
    await putActivity(42); await new Promise(resolve => setTimeout(resolve, 20));
    expect(source.getSnapshot()).toBe(original); expect(changed).not.toHaveBeenCalled();
    await db.deviceSettings.put({key: identity.key, updatedAt: at, value: {broken: true}});
    await vi.waitFor(() => expect(source.getSnapshot().unavailable).toBe(true));
    expect(source.getSnapshot().unread).toBe(true); stop();
});

it("completed background A can reappear through B and StrictMode with a stale accepted observation callback", async () => {
    const connector = {id: "reentry-connector", definitionId: "openai-compatible" as const, protocol: "openai-compatible" as const,
        baseUrl: "https://reentry.fixture/v1", apiKey: "offline-only", updatedAt: at};
    await db.connectors.put(connector);
    await db.chatThreads.put({id: "B", title: "B", createdAt: at, updatedAt: at});
    let release!: () => void;
    const response = new Promise<void>(resolve => {release = resolve;});
    const fetcher = vi.fn<typeof fetch>(async () => {await response; return Response.json({choices: [{message: {content: "A completed while B is visible"}, finish_reason: "stop"}]});});
    const service = createAgentExecutionService({store: new Proxy(db, {}), fetchImpl: fetcher});
    const submitted = createSubmissionAttempt({originThreadId: "A", submitted: {scope: "A", text: "Canonical A user message", textRevision: 1, attachments: [], imports: []},
        recovery: {scope: "A", revision: 2}, connector: {id: connector.id, definitionId: connector.definitionId, baseUrl: connector.baseUrl},
        model: "gpt-4o", taskMode: false, interactionMode: "conversation"});
    const observationResults: boolean[] = [];
    let staleObserved: ((id: string) => void) | undefined;
    let rows: ChatMessage[] = [];
    function AttachedReader({threadId}: {threadId: string}) {
        const subscribe = useCallback((listener: () => void) => service.subscribe(threadId, listener), [threadId]);
        const snapshot = useSyncExternalStore(subscribe, () => service.snapshot(threadId));
        const observed = useCallback((id: string) => {
            const attempt = snapshot.attempts.find(item => item.admission.userMessageId === id);
            if (attempt) observationResults.push(service.dismissAttempt({threadId: attempt.threadId, userMessageId: id}));
        }, [snapshot.attempts]);
        if (snapshot.attempts.length) staleObserved = observed;
        return h(MessageList, {threadId, messages: rows.filter(row => row.threadId === threadId), runs: [], busy: snapshot.active,
            submissions: [...snapshot.attempts], onSubmissionObserved: observed, onRunAction: noop, onRetryRun: noop});
    }
    const attach = async (threadId: string) => act(async () => root.render(h(StrictMode, null, h(AttachedReader, {threadId}))));
    try {
        await service.initialize();
        const original = service.submit({attempt: submitted});
        await attach("A");
        await act(async () => {await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));});
        await attach("B");
        await act(async () => {release(); await original.done;});
        const accepted = service.snapshot("A").attempts;
        expect(accepted[0].phase).toBe("accepted"); expect(Object.isFrozen(accepted[0])).toBe(true);
        rows = await db.chatMessages.where("threadId").equals("A").sortBy("createdAt");
        // This is the offscreen/reappear layout-effect path: the durable user row is first observed after completion.
        await act(async () => root.render(null));
        await attach("A");
        expect(observationResults).toContain(true); expect(observationResults).toContain(false);
        expect(service.snapshot("A").attempts).toEqual([]);
        expect(container.textContent?.match(/Canonical A user message/g)).toHaveLength(1);
        expect(container.textContent).toContain("A completed while B is visible");
        expect(() => staleObserved?.(submitted.admission.userMessageId)).not.toThrow();
        expect(accepted[0].phase).toBe("accepted");
        await attach("B"); await attach("A");
        expect(container.querySelectorAll(".agent-user-bubble")).toHaveLength(1);
        expect(fetcher).toHaveBeenCalledTimes(1);
    } finally {await act(async () => {await service.shutdown();});}
});
