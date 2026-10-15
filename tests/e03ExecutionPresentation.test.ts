// @vitest-environment jsdom
import {act, createElement as h, type ReactNode} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {createExecutionFeedbackController, type ExecutionFeedbackSnapshot} from "@/features/agent/runtime/executionFeedback";
import {ExecutionFeedbackContext, ProvisionalCommitProbe, PublicOutputCommit} from "@/features/agent/ui/ExecutionFeedback";
import {ThinkingPanel} from "@/features/agent/ui/ThinkingPanel";

vi.mock("@/features/agent/ui/AgentMarkdown", async () => {
    const {createElement} = await import("react");
    return {AgentMarkdown: ({children}: {children: ReactNode}) => createElement("p", null, children)};
});

let root: Root, container: HTMLDivElement;
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    // jsdom has no layout engine: provide eligible geometry; hidden/inert/style remain real DOM checks.
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{width: 10, height: 10}] as unknown as DOMRectList);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => {await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();});

function owner() {
    let snapshot: ExecutionFeedbackSnapshot | undefined;
    let children: ReactNode;
    const mark = vi.fn(), measure = vi.fn();
    const controller = createExecutionFeedbackController({timing: {mark, measure, clearMarks: vi.fn(), clearMeasures: vi.fn()},
        onChange: next => {snapshot = next; if (children) render();}});
    const invocation = controller.begin("invocation", "thread");
    function render() {
        root.render(h(ExecutionFeedbackContext, {value: {invocation, snapshot, provisionalMessageId: "user"}}, children));
    }
    return {controller, invocation, mark, render: (node: ReactNode) => {children = node; render();},
        marked: (name: string) => mark.mock.calls.some(([value]) => (value as string).endsWith(`.${name}`))};
}
const identity = {runId: "run", assistantMessageId: "assistant"};
const runtimeIdentity = {runId: "run", executionId: "execution"};
function start(feedback: ReturnType<typeof owner>) {
    feedback.invocation.admitted({id: "run", threadId: "thread", assistantMessageId: "assistant"});
    feedback.invocation.runtime({...runtimeIdentity, type: "started", threadId: "thread", assistantMessageId: "assistant"});
    feedback.invocation.runtime({...runtimeIdentity, type: "baseline", output: {content: "saved before resume"}});
    feedback.invocation.runtime({...runtimeIdentity, type: "requestInvoked"});
}

it("marks the actual provisional DOM independently from admission and keeps its bubble quiet", async () => {
    const feedback = owner();
    expect(feedback.marked("submitted")).toBe(true); expect(feedback.marked("provisionalCommitted")).toBe(false);
    await act(async () => feedback.render(h(ProvisionalCommitProbe, {messageId: "user"},
        h("div", {className: "agent-user-bubble"}, "exact submitted message"))));
    expect(container.textContent).toBe("exact submitted message");
    expect(feedback.marked("provisionalCommitted")).toBe(true); expect(feedback.marked("admitted")).toBe(false);
    expect(container.querySelector('[role="status"]')).toBeNull(); feedback.controller.dispose();
});

it("rejects saved resume text and hidden chat, then records confirmed visible DOM even after release", async () => {
    const feedback = owner();
    await act(async () => {start(feedback); feedback.render(h(PublicOutputCommit,
        {output: identity, text: "saved before resume"}, h("p", null, "saved before resume")));});
    expect(feedback.marked("firstPublicCommitted")).toBe(false);
    await act(async () => {
        feedback.invocation.runtime({...runtimeIdentity, type: "publicReceived", kind: "content"});
        feedback.render(h("section", {inert: true, "data-retained-chat": true},
            h(PublicOutputCommit, {output: identity, text: "new confirmed answer"}, h("p", null, "new confirmed answer"))));
        feedback.invocation.runtime({...runtimeIdentity, type: "checkpoint", confirmed: true, sequence: 1,
            checkpoint: 1, output: {content: "new confirmed answer"}});
        feedback.invocation.release();
    });
    expect(feedback.marked("firstPublicReceived")).toBe(true); expect(feedback.marked("firstCheckpointConfirmed")).toBe(true);
    expect(feedback.marked("released")).toBe(true); expect(feedback.marked("firstPublicCommitted")).toBe(false);
    await act(async () => container.querySelector("section")?.removeAttribute("inert"));
    expect(feedback.marked("firstPublicCommitted")).toBe(true);
    expect(feedback.mark.mock.calls.filter(([value]) => (value as string).endsWith(".firstPublicCommitted"))).toHaveLength(1);
    const styles = vi.spyOn(globalThis, "getComputedStyle");
    await act(async () => feedback.render(h("section", {"data-retained-chat": true},
        h(PublicOutputCommit, {output: identity, text: "new confirmed answer continues"}, h("p", null, "new confirmed answer continues")))));
    expect(styles).not.toHaveBeenCalled();
    feedback.controller.dispose();
});

it("folded reasoning cannot count until its actual body opens, and a foreign run never counts", async () => {
    const feedback = owner();
    await act(async () => {
        start(feedback);
        feedback.invocation.runtime({...runtimeIdentity, type: "publicReceived", kind: "reasoning"});
        feedback.invocation.runtime({...runtimeIdentity, type: "checkpoint", confirmed: true, sequence: 1,
            checkpoint: 1, output: {content: "", reasoning: "confirmed public reasoning"}});
        feedback.render(h(ThinkingPanel, {output: identity, reasoning: "confirmed public reasoning", active: false}));
    });
    expect(container.querySelector(".agent-thinking-content")).toBeNull(); expect(feedback.marked("firstPublicCommitted")).toBe(false);
    await act(async () => container.querySelector("button")?.click());
    expect(container.querySelector(".agent-thinking-content")?.textContent).toBe("confirmed public reasoning");
    expect(feedback.marked("firstPublicCommitted")).toBe(true);
    feedback.controller.dispose();
    const foreign = owner();
    await act(async () => {
        start(foreign);
        foreign.invocation.runtime({...runtimeIdentity, type: "publicReceived", kind: "content"});
        foreign.invocation.runtime({...runtimeIdentity, type: "checkpoint", confirmed: true, sequence: 1,
            checkpoint: 1, output: {content: "new answer"}});
        foreign.render(h(PublicOutputCommit, {output: {...identity, runId: "foreign"}, text: "new answer"}, h("p", null, "new answer")));
    });
    expect(foreign.marked("firstPublicCommitted")).toBe(false); foreign.controller.dispose();
});
