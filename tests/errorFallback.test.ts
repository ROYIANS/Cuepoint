// @vitest-environment jsdom
import {act, Component, createElement as h, type ReactNode} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {ErrorFallbackView, NotFoundView, AGENT_RETRY_NOTICE} from "@/app/errors/ErrorFallback";
import {RootErrorBoundary} from "@/app/errors/RootErrorFallback";
import {installGlobalErrorHandlers, showError} from "@/app/errors/showError";
import {subscribeErrorDetails, getErrorDetailsOpen, closeErrorDetails, openErrorDetails} from "@/app/errors/errorDetailsStore";
import {getLatestError, reportError, resetReportedErrorsForTests, subscribeLatestError} from "@/platform/diagnostics/reportError";
import {collectDiagnosticContext} from "@/platform/diagnostics/errorReport";

vi.mock("sonner", () => ({toast: {error: vi.fn()}}));
const {toast} = await import("sonner");

(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

class Boundary extends Component<{children: ReactNode}, {error: unknown}> {
    state = {error: null as unknown};
    static getDerivedStateFromError(error: unknown) { return {error}; }
    render() {
        return this.state.error
            ? h(ErrorFallbackView, {error: this.state.error, pathname: "/agent/t1", onRetry: () => undefined, onHome: () => undefined, onDetails: openErrorDetails})
            : this.props.children;
    }
}
function Boom(): never { throw new Error("渲染失败"); }

let root: Root, container: HTMLDivElement;
beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    resetReportedErrorsForTests();
    closeErrorDetails();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); });

describe("error fallbacks", () => {
    it("replaces only the workspace and keeps sibling navigation", async () => {
        await act(async () => {
            root.render(h("div", null, h("nav", {"data-nav": ""}, "导航"), h("main", null, h(Boundary, null, h(Boom)))));
        });
        expect(container.querySelector("[data-nav]")).not.toBeNull();
        const alert = container.querySelector("[role=alert]");
        expect(alert?.textContent).toContain("这个页面出错了");
        expect(alert?.textContent).toContain(AGENT_RETRY_NOTICE);
        expect(alert?.textContent).not.toContain("渲染失败");
        const details = [...container.querySelectorAll("button")].find(b => b.textContent === "查看详情")!;
        await act(async () => { details.click(); });
        expect(getErrorDetailsOpen()).toBe(true);
    });
    it("non-agent path omits the agent notice and shows generic input warning", async () => {
        await act(async () => { root.render(h(ErrorFallbackView, {error: new Error("x"), pathname: "/projects", onRetry: () => undefined, onHome: () => undefined, onDetails: () => undefined})); });
        expect(container.textContent).not.toContain("进行中的执行");
        expect(container.textContent).toContain("未发送的输入可能丢失");
    });
    it("renders not found", async () => {
        await act(async () => { root.render(h(NotFoundView, {onHome: () => undefined})); });
        expect(container.textContent).toContain("页面不存在");
    });
    it("root boundary shows reload and reports", async () => {
        await act(async () => { root.render(h(RootErrorBoundary, null, h(Boom))); });
        expect(container.textContent).toContain("重新加载");
        expect(getLatestError()?.source).toBe("boundary");
    });
});

describe("global handlers", () => {
    it("reports error and rejection events but not AbortError", async () => {
        const dispose = installGlobalErrorHandlers(window);
        const rejection = (reason: unknown) => Object.assign(new Event("unhandledrejection"), {reason});
        window.dispatchEvent(rejection(new DOMException("a", "AbortError")));
        expect(toast.error).not.toHaveBeenCalled();
        window.dispatchEvent(rejection(new Error("异步失败")));
        expect(toast.error).toHaveBeenCalledTimes(1);
        expect(getLatestError()?.source).toBe("global");
        window.dispatchEvent(Object.assign(new Event("error"), {error: new Error("同步失败"), message: "同步失败"}));
        expect(toast.error).toHaveBeenCalledTimes(2);
        dispose();
        window.dispatchEvent(rejection(new Error("之后")));
        expect(toast.error).toHaveBeenCalledTimes(2);
    });
});

describe("stores and context", () => {
    it("notifies details subscribers", () => {
        const listener = vi.fn();
        const off = subscribeErrorDetails(listener);
        openErrorDetails();
        closeErrorDetails();
        off();
        openErrorDetails();
        expect(listener).toHaveBeenCalledTimes(2);
    });
    it("notifies latest-error subscribers and collects context", () => {
        const listener = vi.fn();
        const off = subscribeLatestError(listener);
        reportError(new Error("订阅"), {source: "action"});
        off();
        expect(listener).toHaveBeenCalledTimes(1);
        const context = collectDiagnosticContext();
        expect(context.environment).toBe("browser");
        expect(context.version).toBe("dev");
    });
    it("showError toasts a friendly title with a details action", () => {
        showError({cause: new TypeError("Failed to fetch"), actionName: "send-message"});
        const [title, options] = vi.mocked(toast.error).mock.calls[0]!;
        expect(title).toBe("网络请求失败");
        expect(options?.action).toMatchObject({label: "查看详情"});
        expect(getLatestError()?.actionName).toBe("send-message");
    });
});
