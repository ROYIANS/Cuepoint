// @vitest-environment jsdom
import {act, createElement as h} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {RECOVERY_COPY, resolveTopicMarker, STATUS_COPY, topicActivityLabel} from "@/features/agent/ui/statusCopy";
import {createSharedMatrixTicker} from "@/features/agent/ui/ThinkingMatrix";

vi.mock("@lobehub/ui", () => ({
    Flexbox: ({children}: {children?: unknown}) => h("div", null, children as never),
    Text: ({children}: {children?: unknown}) => h("span", null, children as never),
}));
const {TopicStatusCell} = await import("@/features/agent/ui/TopicSidebar");

const none = {busy: false, waitingApproval: false, unread: false, unavailable: false};

describe("topic marker precedence", () => {
    it("orders approval > running > error > unread > none", () => {
        expect(resolveTopicMarker({...none, busy: true, waitingApproval: true, unread: true, unavailable: true})).toBe("approval");
        expect(resolveTopicMarker({...none, busy: true, unread: true, unavailable: true})).toBe("running");
        expect(resolveTopicMarker({...none, unread: true, unavailable: true})).toBe("error");
        expect(resolveTopicMarker({...none, unread: true})).toBe("unread");
        expect(resolveTopicMarker(none)).toBe("none");
    });

    it("announces every active state with shared vocabulary", () => {
        expect(topicActivityLabel({busy: true, waitingApproval: true, unread: true, unavailable: false}))
            .toBe(`${STATUS_COPY.needsApproval}，${STATUS_COPY.running}，${STATUS_COPY.unread}`);
        expect(topicActivityLabel(none)).toBe("");
        expect(RECOVERY_COPY.notConfirmed).toBe("未确认");
    });
});

describe("shared matrix ticker", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("runs one timer for all subscribers and stops with the last", () => {
        const ticker = createSharedMatrixTicker({tickMs: 100, reduced: () => false});
        const spy = vi.spyOn(globalThis, "setInterval");
        const a = vi.fn(), b = vi.fn();
        const offA = ticker.subscribe(a), offB = ticker.subscribe(b);
        expect(spy).toHaveBeenCalledTimes(1);
        const first = ticker.getSnapshot();
        vi.advanceTimersByTime(100);
        expect(a).toHaveBeenCalledTimes(1);
        expect(b).toHaveBeenCalledTimes(1);
        expect(ticker.getSnapshot()).not.toBe(first);
        offA();
        expect(ticker.running()).toBe(true);
        offB();
        expect(ticker.running()).toBe(false);
        spy.mockRestore();
    });

    it("never starts a timer and keeps a static frame under reduced motion", () => {
        const ticker = createSharedMatrixTicker({tickMs: 100, reduced: () => true});
        const off = ticker.subscribe(() => undefined);
        expect(ticker.running()).toBe(false);
        const frame = ticker.getSnapshot();
        vi.advanceTimersByTime(500);
        expect(ticker.getSnapshot()).toBe(frame);
        off();
    });
});

describe("TopicStatusCell", () => {
    let root: Root, container: HTMLDivElement;
    beforeEach(() => {
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
        container = document.createElement("div");
        document.body.append(container);
        root = createRoot(container);
    });
    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        vi.unstubAllGlobals();
    });
    const render = (activity: typeof none) => act(async () => root.render(h(TopicStatusCell, {activity, id: "s"})));
    const cell = () => container.querySelector<HTMLElement>(".agent-topic-row-status")!;

    it("renders exactly one marker per state with an accessible label", async () => {
        await render({...none, busy: true, unread: true});
        expect(cell().dataset.marker).toBe("running");
        expect(cell().querySelectorAll(".agent-dot-matrix")).toHaveLength(1);
        expect(cell().querySelector(".agent-topic-marker")).toBeNull();
        expect(cell().querySelector("#s")!.textContent).toBe(`${STATUS_COPY.running}，${STATUS_COPY.unread}`);

        await render({...none, waitingApproval: true, busy: true});
        expect(cell().querySelector(".agent-topic-marker.is-approval")).not.toBeNull();
        expect(cell().querySelector(".agent-dot-matrix")).toBeNull();
        expect(cell().querySelector("#s")!.textContent).toContain(STATUS_COPY.needsApproval);

        await render({...none, unavailable: true});
        expect(cell().querySelector(".agent-topic-marker.is-error")).not.toBeNull();
        expect(cell().textContent).toContain(STATUS_COPY.readFailed);
        expect(cell().textContent).not.toContain("!");

        await render({...none, unread: true});
        expect(cell().querySelector(".agent-topic-marker.is-unread")).not.toBeNull();

        await render(none);
        expect(cell().dataset.marker).toBe("none");
        expect(cell().querySelector("i, .agent-dot-matrix")).toBeNull();
    });
});
